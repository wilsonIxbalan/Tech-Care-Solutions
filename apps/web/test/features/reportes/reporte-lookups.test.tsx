import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportesPage } from '@/features/reportes/reportes-page'
import { json, renderWithSession } from '../../support/session'

const catalogos = {
  prioridades: [{ id: 1, nombre: 'Normal' }],
  estadosOrden: [{ id: 1, codigo: 'RECIBIDO', nombre: 'Recibido' }],
  tecnicos: [{ id: 7, nombre: 'Técnica de prueba' }],
  categoriasRepuesto: [{ id: 2, nombre: 'Pantallas' }],
  tiposMovimiento: [{ id: 1, codigo: 'AJUSTE_SALIDA', nombre: 'Salida por ajuste' }],
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Opciones operativas de reportes', () => {
  it('obtiene opciones reales sin ejecutar un reporte al abrir la pantalla', async () => {
    const http = vi.fn(async () => json({ data: catalogos }))
    vi.stubGlobal('fetch', http)
    renderWithSession(<ReportesPage />)
    expect(await screen.findByRole('option', { name: 'Técnica de prueba' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Normal' })).toBeVisible()
    expect(http).toHaveBeenCalledTimes(1)
    expect(http.mock.calls[0]).toBeDefined()
    expect(fetch).toHaveBeenCalledWith('/api/v1/catalogos', expect.objectContaining({ credentials: 'include' }))
  })

  it('pagina clientes, conserva la selección y consulta por el ID elegido', async () => {
    const http = vi.fn(async (raw: string) => {
      const url = new URL(raw, 'http://localhost')
      if (url.pathname.endsWith('/catalogos')) return json({ data: catalogos })
      if (url.pathname.endsWith('/clientes')) {
        const page = Number(url.searchParams.get('page'))
        return json({ data: [{ idCliente: page === 1 ? 11 : 22, nombreMostrar: page === 1 ? 'Ana' : 'Beatriz', nit: 'CF' }], meta: { page, pageSize: 20, total: 21, totalPages: 2 } })
      }
      if (url.pathname.endsWith('/historial-cliente')) return json({ data: { cliente: { idCliente: 22, nombreMostrar: 'Beatriz' }, ordenes: [] } })
      throw new Error('Solicitud no prevista: ' + raw)
    })
    vi.stubGlobal('fetch', http)
    renderWithSession(<ReportesPage />)
    await screen.findByRole('option', { name: 'Normal' })
    fireEvent.change(screen.getByLabelText('Reporte *'), { target: { value: 'historial-cliente' } })
    await screen.findByRole('option', { name: 'Ana · CF' })
    fireEvent.change(screen.getByLabelText('Cliente *'), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente: cliente' }))
    await screen.findByRole('option', { name: 'Beatriz · CF' })
    expect(screen.getByLabelText('Cliente *')).toHaveValue('11')
    expect(screen.getByRole('option', { name: 'Ana · CF' })).toBeInTheDocument()
    expect(http.mock.calls.some(([url]) => url.includes('/reportes/'))).toBe(false)
    fireEvent.change(screen.getByLabelText('Cliente *'), { target: { value: '22' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar reporte' }))
    expect(await screen.findByRole('table', { name: 'Cliente' })).toHaveTextContent('Beatriz')
    expect(http.mock.calls.some(([url]) => url.includes('/reportes/historial-cliente?idCliente=22&'))).toBe(true)
  })

  it('reintenta un catálogo fallido y no llama a usuarios para ofrecer filtros', async () => {
    let fail = true
    const http = vi.fn(async () => fail ? json({ error: { code: 'SERVICIO_NO_DISPONIBLE', message: 'Intenta nuevamente.' }, requestId: 'lookup' }, 503) : json({ data: catalogos }))
    vi.stubGlobal('fetch', http)
    renderWithSession(<ReportesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Intenta nuevamente.')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    await screen.findByRole('option', { name: 'Normal' })
    fireEvent.change(screen.getByLabelText('Reporte *'), { target: { value: 'actividad-tecnico' } })
    expect(within(screen.getByLabelText('Técnico *')).getByRole('option', { name: 'Técnica de prueba' })).toBeInTheDocument()
    await waitFor(() => expect(http).toHaveBeenCalledTimes(2))
  })
})
