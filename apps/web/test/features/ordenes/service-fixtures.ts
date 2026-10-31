import type { FacturaDetalleDto, OrdenDetalleDto, ReparacionDto } from '@/types/domain'
import { adminUser, json } from '../../support/session'

export const tecnico = { ...adminUser, idUsuario: 31, roles: ['TECNICO'] as typeof adminUser.roles, nombreCompleto: 'Técnica de servicio' }
export const catalogos = { prioridades: [{ id: 7, nombre: 'Urgente' }], tecnicos: [{ id: 31, nombre: 'Técnica de servicio' }] }
export const orden: OrdenDetalleDto = {
  idOrden: 21, numeroOrden: 'OS-0021', idCliente: 11, clienteNombre: 'Cliente de prueba', idEquipo: 41,
  numeroSerie: 'SERIE-0041', idUsuarioRecepcion: 5, fechaIngreso: '2026-10-25T15:00:00.000Z', problemaReportado: 'No enciende', idPrioridad: 7,
  prioridad: 'Urgente', estado: 'RECIBIDO', fechaEstimada: null, observaciones: null, historial: [{ idHistorial: 1, estadoAnterior: null, estadoNuevo: 'RECIBIDO', fechaCambio: '2026-10-25T15:00:00.000Z', idUsuario: 5, usuarioNombre: 'Recepción', observacion: 'Equipo recibido' }],
  diagnosticos: [], reparaciones: [], factura: null, entrega: null,
}
export const diagnostico = { idDiagnostico: 51, idOrden: 21, idTecnico: 31, tecnicoNombre: 'Técnica de servicio', fechaDiagnostico: '2026-10-25T17:00:00.000Z', descripcion: 'Falla de alimentación', costoManoObraEstimado: '100.00', estado: 'ACTIVO' as const }
export const reparacion: ReparacionDto = { idReparacion: 61, idOrden: 21, idDiagnostico: 51, idTecnico: 31, tecnicoNombre: 'Técnica de servicio', fechaInicio: '2026-10-25T18:00:00.000Z', fechaFin: null, descripcion: 'Reparar alimentación', costoManoObra: '125.00', estado: 'EN_PROCESO', actividades: [], repuestos: [] }
export const factura: FacturaDetalleDto = { idFactura: 71, numeroFactura: 'FAC-0071', idOrden: 21, numeroOrden: 'OS-0021', idCliente: 11, clienteNombre: 'Cliente de prueba', nitFacturacion: 'CF', nombreFacturacion: 'Cliente de prueba', direccionFacturacion: null, fechaFactura: '2026-10-25T20:00:00.000Z', subtotalManoObra: '125.00', subtotalRepuestos: '10.00', porcentajeImpuesto: '12.00', subtotal: '135.00', impuesto: '16.20', total: '151.20', totalPagado: '151.20', saldo: '0.00', estado: 'PAGADA', detalles: [], pagos: [] }
export function list(data: unknown[], page = 1, totalPages = 1) { return json({ data, meta: { page, pageSize: 10, total: data.length ? totalPages * 10 : 0, totalPages } }) }
export function urlOf(input: RequestInfo | URL) { return new URL(String(input), 'http://localhost') }
export function failure(status = 409, details?: Record<string, string[]>) { return json({ error: { code: status === 400 ? 'VALIDACION' : 'CONFLICTO', message: status === 400 ? 'Revisa los campos.' : 'El estado ha cambiado.', details }, requestId: 'test-servicio' }, status) }
