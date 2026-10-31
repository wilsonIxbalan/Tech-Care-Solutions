import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComprasPage } from '@/features/compras/compras-page'
import { CompraForm } from '@/features/compras/compra-form'
import { CompraDetalle } from '@/features/compras/compra-detalle'
import { RecibirCompra } from '@/features/compras/recibir-compra'
import { compraBody, createCompraSchema, estimatePurchase } from '@/features/compras/compra-schema'
import { SupplySelector } from '@/features/inventario/supply-controls'
import { adminUser, bodega, compra, errorResponse, json, list, mockSupply, proveedor, renderWithSession, repuesto, writes } from '../inventario/supply-fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const catalogos = { proveedores: [proveedor], bodegas: [bodega], repuestos: [repuesto] }
const valid = { idProveedor: '101', idBodegaDestino: '303', numeroDocumentoProveedor: '', observaciones: '', items: [{ idRepuesto: '202', cantidad: '2', costoUnitario: '0.1' }] }
function fill() {
  for (const [label, value] of [['Proveedor *', '101'], ['Bodega destino *', '303'], ['Repuesto de línea 1 *', '202'], ['Cantidad *', '2'], ['Costo unitario *', '0.1']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
describe('compras HTTP', () => {
  it('valida cantidades SQL, repuestos únicos, precios y catálogos; body sin actores', () => {
    const schema = createCompraSchema(catalogos)
    expect(compraBody(schema.parse(valid))).toEqual({ idProveedor: 101, idBodegaDestino: 303, numeroDocumentoProveedor: null, observaciones: null, items: [{ idRepuesto: 202, cantidad: 2, costoUnitario: '0.10' }] })
    for (const patch of [{ idProveedor: ' ' }, { idBodegaDestino: '9' }, { items: [] }, { items: [valid.items[0], valid.items[0]] }, ...['0', '-1', '1.5', '2147483648'].map(cantidad => ({ items: [{ ...valid.items[0], cantidad }] })), { items: [{ ...valid.items[0], costoUnitario: '0.001' }] }, { items: [{ ...valid.items[0], cantidad: '101', costoUnitario: '9999999999.99' }] }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
    expect(createCompraSchema({}).safeParse(valid).success).toBe(false)
    expect(estimatePurchase([{ cantidad: '3', costoUnitario: '0.10' }, { cantidad: '1', costoUnitario: '0.20' }])).toBe('0.50')
  })
  it('crea una compra PENDIENTE sin recibirla automáticamente ni recalcular totales', async () => {
    const http = mockSupply(); renderWithSession(<ComprasPage catalogos={catalogos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nueva compra' })); fill()
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar compra' }))
    expect(await screen.findByText('Dato histórico')).toBeVisible()
    expect(writes(http)).toHaveLength(1)
    expect(writes(http)[0][0]).toBe('/api/v1/compras')
    expect(JSON.parse(String(writes(http)[0][1]?.body))).toEqual(compraBody(createCompraSchema(catalogos).parse(valid)))
    expect(screen.getByRole('table', { name: 'Líneas de compra' })).toHaveTextContent('Q 9.99')
    expect(screen.getByText('Total del servidor').nextElementSibling).toHaveTextContent('Q 19.98')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar detalle' }))
    await waitFor(() => expect(http.mock.calls.filter(([url]) => String(url).endsWith('/compras/404')).length).toBeGreaterThan(1))
    expect(writes(http)).toHaveLength(1)
  })
  it('selectores remotos incluyen búsqueda y carga de más resultados para proveedores, bodegas y repuestos', async () => {
    const http = mockSupply(url => ['/proveedores', '/bodegas', '/repuestos'].some(path => url.pathname.endsWith(path)) ? json({ data: [url.pathname.endsWith('/proveedores') ? proveedor : url.pathname.endsWith('/bodegas') ? bodega : repuesto], meta: { page: 1, pageSize: Number(url.searchParams.get('pageSize')), total: 25, totalPages: 3 } }) : undefined)
    renderWithSession(<CompraForm catalogos={{}} onCancel={() => {}} />)
    await screen.findByRole('option', { name: 'Proveedor remoto' })
    const resources = ['proveedores', 'bodegas', 'repuestos']
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Cargar más resultados' })).toHaveLength(3))
    for (const resource of resources) {
      fireEvent.click(screen.getAllByRole('button', { name: 'Cargar más resultados' })[0])
      await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes(`/${resource}?`) && String(url).includes('pageSize=30') && String(url).includes('estado=ACTIV'))).toBe(true))
    }
    for (const [label, resource] of [['Proveedor', 'proveedores'], ['Bodega destino', 'bodegas'], ['Repuesto de línea 1', 'repuestos']]) {
      fireEvent.change(screen.getByLabelText(`${label} *`), { target: { value: 'remoto' } })
      await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes(`/${resource}?`) && String(url).includes('search=remoto') && String(url).includes('page=1'))).toBe(true))
    }
  })
  it('conserva selección aunque cambie la página o búsqueda del selector', async () => {
    const http = mockSupply(url => url.pathname.endsWith('/proveedores') ? json(list(url.searchParams.get('search') ? [] : [proveedor])) : undefined)
    // A controlled selection remains available when the new page has no matching option.
    renderWithSession(<SupplySelector resource="proveedores" label="Proveedor" id="select-proveedor" value="101" selected={{ id: 101, nombre: proveedor.nombre }} onSelect={() => {}} />)
    await screen.findByRole('option', { name: proveedor.nombre })
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: 'otro' } })
    await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes('search=otro'))).toBe(true))
    expect(screen.getByLabelText('Proveedor')).toHaveValue(proveedor.nombre)
    expect(screen.getByRole('option', { name: proveedor.nombre })).toBeInTheDocument()
  })
  it('recepción confirmada envía {} una sola vez, invalida stock/movimientos/compras/dashboard', async () => {
    let resolve!: (value: Response) => void
    const http = mockSupply((url, init) => url.pathname.endsWith('/recibir') && init?.method === 'POST' ? new Promise<Response>(r => { resolve = r }) : undefined)
    const { client } = renderWithSession(<RecibirCompra compra={compra} />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    fireEvent.click(screen.getByRole('button', { name: 'Recibir compra' }))
    expect(writes(http)).toHaveLength(0)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recepción' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar recepción|Recibiendo/ }))
    await waitFor(() => expect(writes(http)).toHaveLength(1))
    expect(writes(http)[0][1]?.body).toBe('{}')
    resolve(json({ data: { idCompra: 404, estado: 'RECIBIDA' } }))
    expect(await screen.findByRole('button', { name: 'Recepción confirmada' })).toBeDisabled()
    for (const resource of ['inventario', 'inventario/movimientos', 'compras', 'dashboard']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [resource] })
    expect(writes(http)).toHaveLength(1)
  })
  it.each(['RECIBIDA', 'ANULADA'] as const)('nunca permite recibir una compra %s', estado => {
    const http = mockSupply(); renderWithSession(<RecibirCompra compra={{ ...compra, estado }} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument(); expect(writes(http)).toHaveLength(0)
  })
  it('conserva borrador y detalles 409; doble envío bloqueado y sin retry', async () => {
    const http = mockSupply((_url, init) => init?.method === 'POST' ? errorResponse() : undefined)
    renderWithSession(<CompraForm catalogos={catalogos} onCancel={() => {}} />); fill()
    const form = screen.getByRole('form', { name: 'Registrar compra' }); fireEvent.submit(form); fireEvent.submit(form)
    expect(await screen.findByText('Operación rechazada.')).toBeVisible()
    expect(screen.getByText('observacion: Revisa el motivo.')).toBeVisible()
    expect(screen.getByLabelText('Costo unitario *')).toHaveValue('0.1')
    expect(writes(http)).toHaveLength(1)
  })
  it('respuesta ambigua de recepción no finge éxito y bloquea repetir', async () => {
    const http = mockSupply((_url, init) => init?.method === 'POST' ? Promise.reject(new TypeError('offline')) : undefined)
    renderWithSession(<RecibirCompra compra={compra} />)
    fireEvent.click(screen.getByRole('button', { name: 'Recibir compra' })); fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))
    await screen.findAllByText(/Resultado no confirmado/)
    expect(screen.getByRole('button', { name: 'Confirmar recepción' })).toBeDisabled()
    expect(screen.queryByText('Recepción confirmada')).not.toBeInTheDocument(); expect(writes(http)).toHaveLength(1)
  })
  it('BODEGA conserva COMPRAS_GESTIONAR sin política de reportes financieros', async () => {
    mockSupply(); renderWithSession(<ComprasPage />, { user: { ...adminUser, roles: ['BODEGA'], permisos: ['COMPRAS_GESTIONAR', 'INVENTARIO_GESTIONAR'] } })
    expect(await screen.findByText('CO-404')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Nueva compra' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ver CO-404' }))
    expect(await screen.findByRole('button', { name: 'Recibir compra' })).toBeEnabled()
  })
  it('detalle mantiene valores históricos del servidor sin catálogo ni totales calculados', () => {
    renderWithSession(<CompraDetalle compra={compra} />)
    expect(screen.getByText('Recepción (Guatemala)').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByText('Documento del proveedor').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByRole('table')).toHaveTextContent('Q 9.99')
    expect(screen.getByRole('table')).toHaveTextContent('Q 19.98')
  })
})
