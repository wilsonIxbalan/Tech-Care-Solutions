import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportesPage as ConnectedReportesPage } from '@/features/reportes/reportes-page'
import { json, renderWithSession as render } from '../../support/session'

function ReportesPage() { return <ConnectedReportesPage catalogos={{}} /> }

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('exportación de reportes', () => {
  it('exporta filtros aplicados sin página, requiere conjunto CSV e incluye todas las hojas en Excel', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/exportar')) return new Response('archivo', { headers: { 'Content-Type': url.includes('formato=csv') ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="reporte.csv"' } })
      return json({ data: [{ idFactura: 1, numeroFactura: 'F-1', total: '10.00', pagos: [] }], meta: { page: url.includes('page=2') ? 2 : 1, pageSize: 20, total: 21, totalPages: 2 } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const create = vi.fn().mockReturnValue('blob:reporte')
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<ReportesPage />)
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Reporte *'), { target: { value: 'facturas-saldo' } })
    fireEvent.change(screen.getByLabelText('Desde (Guatemala)'), { target: { value: '2026-10-22' } })
    fireEvent.change(screen.getByLabelText('Hasta (Guatemala, inclusive)'), { target: { value: '2026-10-22' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reporte' }))
    await screen.findByRole('table', { name: 'Facturas y saldos' })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByText('Página 2 de 2 · 21 registros')
    fireEvent.change(screen.getByLabelText('Conjunto para CSV *'), { target: { value: '2' } })
    const button = screen.getByRole('button', { name: 'Exportar CSV' })
    expect(button).toHaveAccessibleDescription(/todos los resultados.*no solo esta página/i)
    fireEvent.click(button)
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    const csvCall = fetchMock.mock.calls.find(([url]) => url.includes('/exportar'))!
    const params = new URL(`https://test${csvCall[0]}`).searchParams
    expect(Object.fromEntries(params)).toEqual({ fechaDesde: '2026-10-22', fechaHasta: '2026-10-22', conSaldo: 'true', formato: 'csv', conjunto: '2' })
    expect(csvCall[1].credentials).toBe('include')
    expect(revoke).toHaveBeenCalledWith('blob:reporte')
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2))
    const xlsx = fetchMock.mock.calls.find(([url]) => url.includes('formato=xlsx'))![0]
    expect(xlsx).not.toMatch(/conjunto|page/)
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('/exportar'))).toHaveLength(2)
    expect(screen.queryByText(/exportado|descargado correctamente/i)).not.toBeInTheDocument()
  })
  it.each([413, 403])('muestra error %s, no descarga errores JSON y no reintenta', async status => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => url.includes('/exportar')
      ? json({ error: { code: status === 413 ? 'EXPORTACION_DEMASIADO_GRANDE' : 'PERMISO_DENEGADO', message: status === 413 ? 'Reduce los filtros: máximo 10000 filas.' : 'Sin permiso para exportar.' }, requestId: 'export-error' }, status)
      : json({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ReportesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reporte' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Exportar CSV' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(status === 413 ? 'máximo 10000' : 'Sin permiso')
    expect(alert).toHaveTextContent('export-error')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(within(screen.getByLabelText('Conjunto para CSV *')).getAllByRole('option')).toHaveLength(2)
  })
})
