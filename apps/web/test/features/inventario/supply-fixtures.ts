import { vi } from 'vitest'
import type { CompraDetalleDto, InventarioDto, MovimientoDto } from '@/types/domain'
import type { ProveedorRow } from '@/features/proveedores/proveedor-schema'
import type { RepuestoRow } from '@/features/repuestos/repuesto-model'
export { adminUser, json, renderWithSession } from '../../support/session'
import { json } from '../../support/session'

export const proveedor: ProveedorRow = { idProveedor: 101, nombre: 'Proveedor remoto', nit: '123', telefono: '22223333', nombreContacto: null, email: null, direccion: null, estado: 'ACTIVO' }
export const repuesto: RepuestoRow = { idRepuesto: 202, idCategoria: 1, codigo: 'R202', nombre: 'Repuesto remoto', descripcion: null, precioCompraReferencia: '0.10', precioVenta: '0.20', estado: 'ACTIVO' }
export const bodega = { idBodega: 303, nombre: 'Bodega central', codigo: 'BC', estado: 'ACTIVA' as const }
export const categoria = { idCategoria: 1, nombre: 'Componentes' }
export const compra: CompraDetalleDto = { idCompra: 404, numeroCompra: 'CO-404', idProveedor: 101, proveedorNombre: proveedor.nombre, idBodegaDestino: 303, bodegaNombre: bodega.nombre, idUsuarioRegistro: 1, fechaCompra: '2026-10-22T18:00:00Z', fechaRecepcion: null, idUsuarioRecepcion: null, numeroDocumentoProveedor: null, estado: 'PENDIENTE', observaciones: 'Dato histórico', total: '19.98', items: [{ idDetalleCompra: 1, idRepuesto: 202, codigoRepuesto: 'R202', repuestoNombre: repuesto.nombre, cantidad: 2, costoUnitario: '9.99', subtotal: '19.98' }] }
export const stock: InventarioDto = { idBodega: 303, bodegaNombre: bodega.nombre, idCategoria: 1, categoriaNombre: categoria.nombre, idRepuesto: 202, codigoRepuesto: 'R202', repuestoNombre: repuesto.nombre, existencia: 7, stockMinimo: 2, bajoMinimo: false, sinStock: false, fechaUltimoMovimiento: null }
export const movimiento: MovimientoDto = { idMovimiento: 505, idBodega: 303, bodegaNombre: bodega.nombre, idRepuesto: 202, codigoRepuesto: 'R202', repuestoNombre: repuesto.nombre, codigoTipoMovimiento: 'AJUSTE_ENTRADA', naturaleza: 'E', cantidad: 7, fechaMovimiento: '2026-10-22T18:00:00Z', idUsuario: 1, usuarioNombre: 'Operador', documentoOrigen: 'AJUSTE', numeroDocumento: 'AJ-505', existenciaResultante: 7, observacion: 'Conteo' }
export function list(data: unknown[], page = 1, totalPages = 1) { return { data, meta: { page, pageSize: 20, total: data.length * totalPages, totalPages } } }
export function errorResponse(status = 409) { return json({ error: { code: 'CONFLICTO', message: 'Operación rechazada.', details: { observacion: ['Revisa el motivo.'] } }, requestId: 'req-stock' }, status) }
export function mockSupply(override?: (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const custom = override?.(url, init)
    if (custom !== undefined) return custom
    const path = url.pathname.replace('/api/v1', '')
    if (init?.method === 'POST' || init?.method === 'PATCH') {
      if (path === '/proveedores' || path.startsWith('/proveedores/')) return json({ data: proveedor })
      if (path === '/repuestos' || path.startsWith('/repuestos/')) return json({ data: repuesto })
      if (path.endsWith('/stock-minimo')) return json({ data: { idBodega: 303, idRepuesto: 202, ...JSON.parse(String(init.body)) } })
      if (path === '/inventario/ajustes') return json({ data: { idBodega: 303, idRepuesto: 202, existenciaResultante: 11 } })
      if (path.endsWith('/recibir')) return json({ data: { idCompra: 404, estado: 'RECIBIDA' } })
      if (path === '/compras') return json({ data: { idCompra: 404, numeroCompra: 'CO-404', estado: 'PENDIENTE' } }, 201)
      throw new Error(`Unexpected write ${path}`)
    }
    if (path === '/catalogos') return json({ data: { categoriasRepuesto: [{ id: 1, nombre: 'Componentes' }], tiposMovimiento: [{ codigo: 'AJUSTE_ENTRADA', nombre: 'Ajuste entrada' }, { codigo: 'AJUSTE_SALIDA', nombre: 'Ajuste salida' }] } })
    if (path === '/compras/404') return json({ data: compra })
    const rows: Record<string, unknown[]> = { '/proveedores': [proveedor], '/repuestos': [repuesto], '/bodegas': [bodega], '/compras': [compra], '/inventario': [stock], '/inventario/movimientos': [movimiento] }
    if (rows[path]) return json(list(rows[path], Number(url.searchParams.get('page') ?? 1)))
    throw new Error(`Unexpected read ${path}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
export function writes(mock: ReturnType<typeof mockSupply>) { return mock.mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH') }
