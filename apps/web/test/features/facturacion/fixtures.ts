import { vi } from 'vitest'
import type { FacturaDetalleDto, OrdenDetalleDto } from '@/types/domain'
import { json } from '../../support/session'

export const factura: FacturaDetalleDto = {
  idFactura: 1, numeroFactura: 'F-1', idOrden: 2, numeroOrden: 'OS-2', idCliente: 3, clienteNombre: 'Ana Pérez', nitFacturacion: 'CF', nombreFacturacion: 'Ana Pérez', direccionFacturacion: null, fechaFactura: '2026-10-22T12:00:00Z', subtotalManoObra: '10.00', subtotalRepuestos: '0.00', porcentajeImpuesto: '12.00', subtotal: '10.00', impuesto: '1.20', total: '11.20', totalPagado: '1.20', saldo: '10.00', estado: 'EMITIDA',
  detalles: [{ idDetalleFactura: 1, tipoLinea: 'MANO_OBRA', idReparacion: 11, idRepuestoReparacion: null, descripcion: 'Mantenimiento', cantidad: '2.00', precioUnitario: '5.00', subtotal: '10.00' }],
  pagos: [
    { idPago: 1, idFactura: 1, idMetodoPago: 1, metodoPagoNombre: 'Efectivo', monto: '1.20', fechaPago: '2026-10-22T12:00:00Z', referencia: null, idUsuario: 1, usuarioNombre: 'Cajera', estado: 'APLICADO', motivoAnulacion: null },
    { idPago: 2, idFactura: 1, idMetodoPago: 1, metodoPagoNombre: 'Efectivo', monto: '5.00', fechaPago: '2026-10-22T12:00:00Z', referencia: null, idUsuario: 1, usuarioNombre: 'Cajera', estado: 'ANULADO', motivoAnulacion: 'Referencia duplicada' },
  ],
}
export const orden: OrdenDetalleDto = {
  idOrden: 2, numeroOrden: 'OS-2', idCliente: 3, clienteNombre: 'Ana Pérez', idEquipo: 4, numeroSerie: 'SER-4', idUsuarioRecepcion: 1, fechaIngreso: '2026-10-20T12:00:00Z', problemaReportado: 'No enciende', idPrioridad: 1, prioridad: 'Normal', estado: 'LISTO', fechaEstimada: null, observaciones: null, historial: [], diagnosticos: [], reparaciones: [], factura: null, entrega: null,
}
export const metodos = [{ idMetodoPago: 1, nombre: 'Efectivo', activo: true }]
export const preview = { subtotalManoObra: '100.00', subtotalRepuestos: '4.00', porcentajeImpuesto: '12.00', impuesto: '0.77', total: '103.77' }
export const invoiceResult = { idFactura: 7, numeroFactura: 'F-7', estado: 'EMITIDA', saldo: '103.77', total: '103.77', subtotalManoObra: '100.00', subtotalRepuestos: '4.00', subtotal: '104.00', impuesto: '0.77' }
export function page(data: unknown[], current = 1, totalPages = 1) { return { data, meta: { page: current, pageSize: 20, total: data.length * totalPages, totalPages } } }
export function failure(status: number, message = 'La operación fue rechazada.', details?: Record<string, string[]>) { return json({ error: { code: status === 409 ? 'CONFLICTO' : 'VALIDACION', message, details }, requestId: `billing-${status}` }, status) }
export type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined
export function mockBilling(handler: Handler = () => undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const custom = handler(url, init)
    if (custom !== undefined) return custom
    const path = url.pathname.replace('/api/v1', '')
    if (init?.method === 'POST') {
      if (/\/ordenes\/\d+\/factura$/.test(path)) return json({ data: invoiceResult }, 201)
      if (/\/facturas\/\d+\/pagos$/.test(path)) return json({ data: { idPago: 3, idFactura: Number(path.split('/')[2]), saldo: '9.90', estadoFactura: 'EMITIDA' } }, 201)
      if (/\/pagos\/\d+\/anular$/.test(path)) return json({ data: { idPago: Number(path.split('/')[2]), estado: 'ANULADO', saldo: '11.20', estadoFactura: 'EMITIDA' } })
    }
    if (path === '/facturas') return json(page([factura]))
    if (/\/facturas\/\d+$/.test(path)) return json({ data: { ...factura, idFactura: Number(path.split('/')[2]) } })
    if (path === '/ordenes') return json(page([orden]))
    if (/\/ordenes\/\d+\/resumen-facturacion$/.test(path)) return json({ data: { ...preview, porcentajeImpuesto: url.searchParams.get('porcentajeImpuesto') } })
    if (/\/ordenes\/\d+$/.test(path)) return json({ data: { ...orden, idOrden: Number(path.split('/')[2]) } })
    if (path === '/catalogos') return json({ data: { metodosPago: [{ id: 1, nombre: 'Efectivo', activo: true }, { id: 2, nombre: 'Inactivo', activo: false }] } })
    throw new Error(`Unexpected request: ${url} ${init?.method ?? 'GET'}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
export function posts(fetchMock: ReturnType<typeof mockBilling>) { return fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST') }
