import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReparacionesSection } from '@/features/reparaciones/reparaciones-section'
import { ReparacionForm } from '@/features/reparaciones/reparacion-form'
import { ConsumoForm } from '@/features/reparaciones/consumo-form'
import { actividadInputSchema, cantidadConsumoSchema } from '@/features/reparaciones/reparacion-schema'
import { validateServiceResult } from '@/features/ordenes/api'
import { renderWithSession, json, adminUser } from '../../support/session'
import { orden, tecnico, diagnostico, reparacion, failure, list } from '../ordenes/service-fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const orderRepair = { ...orden, estado: 'REPARACION' as const, diagnosticos: [diagnostico], reparaciones: [reparacion] }
async function confirm(formName: string) {
  fireEvent.submit(screen.getByRole('form', { name: formName }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar operación' }))
}
describe('reparaciones operativas', () => {
  it('inicia reparación con DTO sin IDs de diagnóstico/técnico y confirmación explícita', async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Response>(() => json({ data: { idReparacion: 61, idOrden: 21, estado: 'EN_PROCESO', estadoOrden: 'REPARACION' } }, 201))
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<ReparacionForm orden={{ ...orden, estado: 'ESPERANDO_AUTORIZACION', diagnosticos: [diagnostico] }} onCancel={vi.fn()} />, { user: tecnico })
    fireEvent.change(screen.getByLabelText('Descripción de la reparación *'), { target: { value: 'Reparar alimentación' } })
    fireEvent.change(screen.getByLabelText('Costo de mano de obra *'), { target: { value: '125' } })
    await confirm('Iniciar reparación')
    await screen.findByText(/Operación registrada/)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/ordenes/21/reparaciones')
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ descripcion: 'Reparar alimentación', costoManoObra: '125.00' })
  })
  it('registra actividad y normaliza horas DECIMAL(5,2) sin actor en el JSON', async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Response>(() => json({ data: { idActividad: 81 } }, 201))
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<ReparacionesSection orden={orderRepair} />, { user: tecnico })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar actividad' }))
    fireEvent.change(screen.getByLabelText('Descripción de la actividad *'), { target: { value: 'Medir voltajes' } })
    fireEvent.change(screen.getByLabelText('Horas invertidas *'), { target: { value: '01.5' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar actividad' }))
    await screen.findByText(/Operación registrada/)
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/reparaciones/61/actividades')
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ descripcion: 'Medir voltajes', horasInvertidas: '1.50' })
  })
  it('finaliza con observación nullable y no afirma LISTO cuando quedan otros trabajos', async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Response>(() => json({ data: { idReparacion: 61, estado: 'FINALIZADA', estadoOrden: 'REPARACION' } }))
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<ReparacionesSection orden={orderRepair} />, { user: tecnico })
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar reparación' }))
    await confirm('Finalizar reparación')
    await screen.findByText(/Operación registrada/)
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/reparaciones/61/finalizar')
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ observacion: null })
    expect(screen.queryByText(/^LISTO$/)).not.toBeInTheDocument()
  })
  it('aplica restricciones de responsable/admin y rol adicional de actividades', () => {
    renderWithSession(<ReparacionesSection orden={orderRepair} />, { user: { ...tecnico, idUsuario: 99 } })
    expect(screen.queryByRole('button', { name: 'Finalizar reparación' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar actividad' })).toBeVisible()
  })
  it('administrador sin TECNICO puede finalizar pero no iniciar ni registrar actividad', () => {
    renderWithSession(<ReparacionesSection orden={orderRepair} />, { user: adminUser })
    expect(screen.getByRole('button', { name: 'Finalizar reparación' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Registrar actividad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Iniciar reparación' })).not.toBeInTheDocument()
  })
  it('consume inventario real, valida stock y registra solo IDs/cantidad; invalida stock, caja y dashboard', async () => {
    const stock = { idBodega: 4, bodegaNombre: 'Central', idRepuesto: 9, codigoRepuesto: 'REP-9', repuestoNombre: 'Conector', existencia: 3 }
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Response>((input, init) => init?.method === 'POST' && String(input).endsWith('/repuestos') ? json({ data: { idRepuestoReparacion: 91, existenciaResultante: 1 } }, 201) : list([stock]))
    vi.stubGlobal('fetch', fetcher)
    const { client } = renderWithSession(<ConsumoForm idReparacion={61} onCancel={vi.fn()} />, { user: tecnico })
    const invalidations = vi.spyOn(client, 'invalidateQueries')
    await screen.findByRole('option', { name: /REP-9/ })
    fireEvent.change(screen.getByLabelText('Existencia *'), { target: { value: '4-9' } })
    fireEvent.change(screen.getByLabelText('Cantidad *'), { target: { value: '4' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Consumir repuesto' }))
    expect(await screen.findByText(/cantidad supera/)).toBeVisible()
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Cantidad *'), { target: { value: '2' } })
    await confirm('Consumir repuesto')
    await screen.findByText('Existencia resultante de este movimiento: 1.')
    const [input, init] = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(input).toBe('/api/v1/reparaciones/61/repuestos')
    expect(JSON.parse(String(init?.body))).toEqual({ idBodega: 4, idRepuesto: 9, cantidad: 2 })
    for (const key of ['inventario', 'ordenes', 'dashboard', 'caja']) expect(invalidations).toHaveBeenCalledWith({ queryKey: [key] })
  })
  it('un conflicto de actividad conserva el formulario y el error de campo', async () => {
    const fetcher = vi.fn(() => failure(400, { horasInvertidas: ['Horas no válidas.'] }))
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<ReparacionesSection orden={orderRepair} />, { user: tecnico })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar actividad' }))
    fireEvent.change(screen.getByLabelText('Descripción de la actividad *'), { target: { value: 'Revisar' } })
    fireEvent.change(screen.getByLabelText('Horas invertidas *'), { target: { value: '2' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar actividad' }))
    await screen.findByText('Revisa los campos.')
    expect(screen.getByLabelText('Horas invertidas *')).toHaveValue('2')
    expect(screen.getByLabelText('Horas invertidas *')).toHaveAttribute('aria-invalid', 'true')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('presenta históricos de actividades y repuestos sin recalcular precios/subtotales', () => {
    const r = { ...reparacion, actividades: [{ idActividad: 81, idReparacion: 61, idTecnico: 31, tecnicoNombre: 'Técnica', descripcion: 'Medición', fechaActividad: '2026-10-25T18:00:00.000Z', horasInvertidas: '1.50' }], repuestos: [{ idRepuestoReparacion: 91, idReparacion: 61, idBodega: 4, bodegaNombre: 'Central', idRepuesto: 9, codigoRepuesto: 'REP-9', repuestoNombre: 'Conector', cantidad: 2, precioCostoUnitario: '1.00', precioVentaUnitario: '3.00', subtotal: '5.50', fechaAsignacion: '2026-10-25T18:00:00.000Z', idUsuario: 31, estado: 'ACTIVO' as const }] }
    renderWithSession(<ReparacionesSection orden={{ ...orderRepair, reparaciones: [r] }} />, { user: tecnico })
    expect(within(screen.getByRole('table', { name: 'Actividades' })).getByText('1.50')).toBeVisible()
    expect(within(screen.getByRole('table', { name: 'Repuestos consumidos' })).getByText('Q 5.50')).toBeVisible()
  })
  it.each(['0', '-1', '1000', '1.234', '1e2'])('rechaza horas fuera del contrato: %s', value => {
    expect(actividadInputSchema.safeParse({ descripcion: 'Medir', horasInvertidas: value }).success).toBe(false)
  })
  it.each(['0', '-1', '1.5', '2147483648'])('rechaza cantidades inválidas: %s', value => expect(cantidadConsumoSchema.safeParse(value).success).toBe(false))
  it.each([-1, 1.5, '2', null])('no muestra éxito con existenciaResultante inválida %s', value => {
    expect(() => validateServiceResult('/reparaciones/61/repuestos', { idRepuestoReparacion: 91, existenciaResultante: value })).toThrow(/verificar la respuesta/)
  })
})
