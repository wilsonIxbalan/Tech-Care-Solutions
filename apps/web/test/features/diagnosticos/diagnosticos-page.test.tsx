import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiagnosticoForm } from '@/features/diagnosticos/diagnostico-form'
import { DiagnosticosPage } from '@/features/diagnosticos/diagnosticos-page'
import { renderWithSession, json, adminUser } from '../../support/session'
import { catalogos, orden, tecnico, failure, list, urlOf, diagnostico } from '../ordenes/service-fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('diagnósticos conectados', () => {
  it('consulta órdenes reales en diagnóstico y enlaza el flujo', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => urlOf(input).pathname.endsWith('/catalogos') ? json({ data: catalogos }) : list([{ ...orden, estado: 'DIAGNOSTICO' }]))
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<DiagnosticosPage />, { user: tecnico })
    expect(await screen.findByRole('link', { name: 'OS-0021' })).toHaveAttribute('href', '/ordenes/21')
    expect(fetcher.mock.calls.some(([input]) => urlOf(input).searchParams.get('estado') === 'DIAGNOSTICO')).toBe(true)
  })
  it('envía solo DiagnosisInput, normaliza dinero y toma actor de sesión sin selector de técnico', async () => {
    const fetcher = vi.fn(() => json({ data: { idDiagnostico: 51, idOrden: 21, estadoOrden: 'ESPERANDO_AUTORIZACION' } }, 201))
    vi.stubGlobal('fetch', fetcher)
    const { client } = renderWithSession(<DiagnosticoForm orden={orden} onCancel={vi.fn()} />, { user: tecnico })
    const invalidations = vi.spyOn(client, 'invalidateQueries')
    fireEvent.change(screen.getByLabelText('Descripción del diagnóstico *'), { target: { value: '  Falla de alimentación  ' } })
    fireEvent.change(screen.getByLabelText('Costo estimado de mano de obra *'), { target: { value: '0' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar diagnóstico' }))
    expect(await screen.findByText(/Operación registrada/)).toBeVisible()
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [input, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(input).toBe('/api/v1/ordenes/21/diagnostico')
    expect(JSON.parse(String(init.body))).toEqual({ descripcion: 'Falla de alimentación', costoManoObraEstimado: '0.00' })
    expect(invalidations).toHaveBeenCalledWith({ queryKey: ['ordenes'] })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
  it.each(['', '-1', '1.234', '10000000000.00'])('conserva validación del importe %j sin POST', async costo => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<DiagnosticoForm orden={orden} onCancel={vi.fn()} />, { user: tecnico })
    fireEvent.change(screen.getByLabelText('Descripción del diagnóstico *'), { target: { value: 'Falla' } })
    fireEvent.change(screen.getByLabelText('Costo estimado de mano de obra *'), { target: { value: costo } })
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar diagnóstico' }))
    await waitFor(() => expect(screen.getByLabelText('Costo estimado de mano de obra *')).toHaveAttribute('aria-invalid', 'true'))
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('exige rol adicional TECNICO incluso con todos los permisos de administrador', () => {
    renderWithSession(<DiagnosticoForm orden={orden} onCancel={vi.fn()} />, { user: adminUser })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
  it('bloquea un segundo diagnóstico activo y mantiene contenido ante conflicto sin retry', async () => {
    const fetcher = vi.fn(() => failure())
    vi.stubGlobal('fetch', fetcher)
    const view = renderWithSession(<DiagnosticoForm orden={orden} onCancel={vi.fn()} />, { user: tecnico })
    fireEvent.change(screen.getByLabelText('Descripción del diagnóstico *'), { target: { value: 'Falla' } })
    fireEvent.change(screen.getByLabelText('Costo estimado de mano de obra *'), { target: { value: '25' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar diagnóstico' }))
    expect(await screen.findByText('El estado ha cambiado.')).toBeVisible()
    expect(screen.getByLabelText('Descripción del diagnóstico *')).toHaveValue('Falla')
    expect(screen.getByLabelText('Costo estimado de mano de obra *')).toHaveValue('25')
    expect(fetcher).toHaveBeenCalledTimes(1)
    view.unmount()
    renderWithSession(<DiagnosticoForm orden={{ ...orden, diagnosticos: [diagnostico] }} onCancel={vi.fn()} />, { user: tecnico })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
})
