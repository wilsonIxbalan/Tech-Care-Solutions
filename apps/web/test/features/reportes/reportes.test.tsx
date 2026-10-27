import { fireEvent, screen, within, waitFor } from '@testing-library/react'
import { adminUser, json, renderWithSession as render } from '../../support/session'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportesPage as ConnectedReportesPage } from '@/features/reportes/reportes-page'
import { createReportSchema } from '@/features/reportes/reporte-schema'
import { reportDefinitions, reportHttpFilters } from '@/features/reportes/reportes-model'

const query = () => fireEvent.click(screen.getByRole('button', { name: 'Consultar reporte' }))
// Este grupo aísla la consulta del reporte; los lookups HTTP se prueban aparte.
function ReportesPage() { return <ConnectedReportesPage catalogos={{}} /> }
const select = (id: string) => fireEvent.change(screen.getByLabelText('Reporte *'), { target: { value: id } })
const inventory = { idBodega: 1, bodegaNombre: 'Bodega central', idCategoria: 2, categoriaNombre: 'Pantallas', idRepuesto: 3, codigo: 'P-3', repuestoNombre: 'Panel', existencia: 0, stockMinimo: 5, fechaUltimoMovimiento: null }
const order = { idOrden: 9, numeroOrden: 'OS-9', clienteNombre: 'Ana', numeroSerie: 'S-9', fechaIngreso: '2026-10-22T12:00:00Z', estado: 'RECIBIDO', historial: [{ idHistorial: 1, estadoAnterior: null, estadoNuevo: 'RECIBIDO', observacion: null }], diagnosticos: [{ idDiagnostico: 4, descripcion: 'Pantalla dañada', costoManoObraEstimado: '0.00' }], reparaciones: [{ idReparacion: 5, descripcion: 'Cambio de panel', actividades: [{ descripcion: 'Verificación' }], repuestos: [{ repuestoNombre: 'Panel nuevo', precioVentaUnitario: '10.00' }] }], factura: null, entrega: null }

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => json({ data: [] }))))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('reportes conectados', () => {
  it.each(['TECNICO', 'RECEPCION', 'BODEGA'] as const)('restringe reportes financieros para %s', role => {
    render(<ReportesPage />, { user: { ...adminUser, roles: [role] } })
    const selector = screen.getByLabelText('Reporte *')
    for (const title of ['Facturas, pagos y saldo', 'Ingresos facturados por mes', 'Compras por proveedor']) expect(within(selector).queryByRole('option', { name: title })).not.toBeInTheDocument()
  })
  it('permite reportes financieros a Caja y exige REPORTES_VER incluso al administrador', () => {
    const { unmount } = render(<ReportesPage />, { user: { ...adminUser, roles: ['CAJA'] } })
    expect(screen.getByRole('option', { name: 'Ingresos facturados por mes' })).toBeInTheDocument()
    unmount()
    render(<ReportesPage />, { user: { ...adminUser, permisos: [] } })
    expect(screen.getByText('Acceso restringido')).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('ofrece doce reportes, cambia filtros y permite identificadores en un catálogo explícito', () => {
    render(<ReportesPage />)
    expect(within(screen.getByLabelText('Reporte *')).getAllByRole('option')).toHaveLength(13)
    select('historial-equipo')
    expect(screen.getByLabelText('Número de serie *')).toBeVisible()
    expect(screen.queryByLabelText('Desde (Guatemala)')).not.toBeInTheDocument()
    select('actividad-tecnico')
    expect(screen.queryByLabelText('Número de serie *')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar reporte' })).toBeEnabled()
    select('facturas-saldo')
    expect(screen.getByLabelText('Sólo facturas con saldo *')).toBeRequired()
    expect(screen.getByLabelText('Sólo facturas con saldo *')).toHaveValue('1')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('valida fechas inclusivas, técnico, series e identificadores y opciones recibidas', () => {
    const report = reportDefinitions.find(r => r.id === 'actividad-tecnico')!
    const schema = createReportSchema(report, { tecnicos: [{ value: '2', label: 'Técnico de prueba' }] })
    const valid = { IdTecnico: '2', Desde: '2026-10-21', HastaExclusiva: '2026-10-21' }
    expect(schema.safeParse(valid).success).toBe(true)
    for (const patch of [{ IdTecnico: '3' }, { IdTecnico: '0' }, { IdTecnico: '2147483648' }, { Desde: '' }, { HastaExclusiva: '2026-10-20' }, { Desde: '2026-02-30' }, { HastaExclusiva: '9999-12-31' }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
    expect(createReportSchema(report, {}).safeParse(valid).success).toBe(true)
    const serie = createReportSchema(reportDefinitions.find(r => r.id === 'historial-equipo')!, {})
    expect(serie.safeParse({ NumeroSerie: 'x'.repeat(61) }).success).toBe(false)
  })
  it('solo consulta filtros ejecutados, usa camelCase y no presenta resultados anteriores al editar', async () => {
    vi.mocked(fetch).mockImplementation(async () => json({ data: [inventory] }))
    render(<ReportesPage />)
    select('inventario')
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Bodega'), { target: { value: '1' } })
    query()
    expect(await screen.findByRole('table', { name: 'Existencias' })).toHaveTextContent('Bodega central')
    expect(screen.getByRole('table', { name: 'Existencias' })).toHaveTextContent('0')
    expect(screen.getByRole('table', { name: 'Existencias' })).toHaveTextContent('—')
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/reportes/inventario?idBodega=1&page=1&pageSize=20')
    expect(options?.credentials).toBe('include')
    fireEvent.change(screen.getByLabelText('Bodega'), { target: { value: '2' } })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
    query()
    await screen.findByRole('table')
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain('idBodega=2')
  })
  it('muestra carga, vacío y error contractual sin reintentos ni éxito ficticio', async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
    render(<ReportesPage />)
    query()
    expect(await screen.findByRole('status')).toHaveTextContent('Consultando reporte')
    resolve(json({ data: [] }))
    expect(await screen.findByText('Consulta sin resultados')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'RECIBIDO' } })
    vi.mocked(fetch).mockResolvedValueOnce(json({ error: { code: 'VALIDACION', message: 'Intervalo inválido.', details: { fechaHasta: ['Revisa la fecha final.'] } }, requestId: 'report-error' }, 400))
    query()
    expect(await screen.findByRole('alert')).toHaveTextContent('Intervalo inválido. Revisa la fecha final. Referencia: report-error')
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('un resultado tardío no se muestra bajo filtros distintos', async () => {
    let resolve!: (response: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
    render(<ReportesPage />)
    select('inventario')
    query()
    await screen.findByRole('status')
    fireEvent.change(screen.getByLabelText('Bodega'), { target: { value: '2' } })
    resolve(json({ data: [inventory] }))
    await waitFor(() => expect(screen.queryByText('Bodega central')).not.toBeInTheDocument())
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it.each(['historial-cliente', 'historial-equipo'])('conserva las relaciones anidadas reales de %s sin search', async slug => {
    const client = slug === 'historial-cliente'
    vi.mocked(fetch).mockResolvedValue(json({ data: { [client ? 'cliente' : 'equipo']: { [client ? 'idCliente' : 'idEquipo']: 1, nombreMostrar: 'Ana', numeroSerie: 'S-9' }, ordenes: [order] } }))
    render(<ReportesPage />)
    select(slug)
    fireEvent.change(screen.getByLabelText(client ? 'Cliente *' : 'Número de serie *'), { target: { value: client ? '1' : 'S-9' } })
    query()
    expect(await screen.findByRole('table', { name: client ? 'Cliente' : 'Equipo' })).toHaveTextContent('Ana')
    expect(screen.getByRole('table', { name: 'Diagnósticos' })).toHaveTextContent('Pantalla dañada')
    expect(screen.getByRole('table', { name: 'Actividades' })).toHaveTextContent('Verificación')
    expect(screen.getByRole('table', { name: 'Consumos de repuestos' })).toHaveTextContent('Q 10.00')
    expect(screen.getByRole('table', { name: 'Historial de estados' })).toHaveTextContent('—')
    expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toMatch(/search|IdCliente|NumeroSerie/)
    expect(within(screen.getByLabelText('Conjunto para CSV *')).getAllByRole('option')).toHaveLength(3)
  })
  it('conserva un cliente sin órdenes sin fabricar filas ni sumas', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ data: { cliente: { idCliente: 1, nombreMostrar: 'Ana', nit: 'CF' }, ordenes: [] } }))
    render(<ReportesPage />)
    select('historial-cliente')
    fireEvent.change(screen.getByLabelText('Cliente *'), { target: { value: '1' } })
    query()
    expect(await screen.findByRole('table', { name: 'Cliente' })).toHaveTextContent('Ana')
    expect(screen.getByText('Consulta sin resultados')).toBeVisible()
  })
  it('separa facturas y pagos sin multiplicar el total', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ data: [{ idFactura: 1, numeroFactura: 'F-1', total: '10.00', totalPagado: '0.00', saldo: '10.00', pagos: [{ idPago: 1, idFactura: 1, monto: '0.00', estado: 'ANULADO', referencia: null }] }] }))
    render(<ReportesPage />)
    select('facturas-saldo')
    query()
    expect(await screen.findByRole('table', { name: 'Facturas y saldos' })).toHaveTextContent('F-1')
    expect(screen.getByRole('table', { name: 'Pagos de las facturas consultadas' })).toHaveTextContent('ANULADO')
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('conSaldo=true')
  })
  it('trazabilidad conserva orden, pagos e historial separados y tres conjuntos CSV', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ data: { orden: { idOrden: 9, numeroOrden: 'OS-9' }, historial: order.historial, diagnosticos: [], reparaciones: [], movimientos: [], factura: null, pagos: [{ idPago: 8, monto: '1.00', estado: 'APLICADO' }], entrega: null } }))
    render(<ReportesPage />)
    select('trazabilidad')
    fireEvent.change(screen.getByLabelText('Orden *'), { target: { value: '9' } })
    query()
    expect(await screen.findByRole('table', { name: 'Orden' })).toHaveTextContent('OS-9')
    expect(screen.getByRole('table', { name: 'Pagos' })).toHaveTextContent('Q 1.00')
    expect(screen.getByRole('table', { name: 'Historial de estados' })).toHaveTextContent('RECIBIDO')
    expect(within(screen.getByLabelText('Conjunto para CSV *')).getAllByRole('option')).toHaveLength(4)
  })
  it('valida antes de consultar y cancelar limpia los resultados y devuelve foco', async () => {
    render(<ReportesPage />)
    select('historial-equipo')
    query()
    expect(await screen.findByRole('alert')).toHaveTextContent('obligatorio')
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Número de serie *'), { target: { value: 'Serie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByLabelText('Reporte *')).toHaveFocus()
    expect(screen.getByLabelText('Número de serie *')).toHaveValue('')
  })
  it('mapea fechas inclusivas y código de movimiento sin filtrar metadatos a HTTP', () => {
    const params = reportHttpFilters(reportDefinitions.find(r => r.id === 'movimientos')!, { Desde: '2026-10-22', HastaExclusiva: '2026-10-22', CodigoTipo: 'AJUSTE', IdUsuario: '4', procedure: 'SQL', search: 'no', page: '8' })
    expect(Object.fromEntries(params)).toEqual({ fechaDesde: '2026-10-22', fechaHasta: '2026-10-22', codigoTipoMovimiento: 'AJUSTE', idUsuario: '4' })
  })
})
