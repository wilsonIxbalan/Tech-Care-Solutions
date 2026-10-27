import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useSession } from '@/features/auth/session-context'
import { ApiError, apiFetch } from '@/lib/api-client'
import type { FacturaDetalleDto, FacturaResumenDto, OrdenDetalleDto, OrdenResumenDto } from '@/types/domain'
import type { MetodoPagoOption } from './facturacion-schema'

export const facturasReadPermissions = ['FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER']
export interface FacturaFilters {
  page: number; pageSize: number; search: string; estado: string; conSaldo: string
  idCliente: string; fechaDesde: string; fechaHasta: string
}
export function billingQuery(filters: Record<string, string | number>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (String(value).trim()) query.set(key, String(value).trim())
  return query
}
export function useFacturas(filters: FacturaFilters) {
  const { user } = useSession()
  return useQuery({ queryKey: ['facturas', user?.idUsuario, 'list', filters], retry: false,
    enabled: Boolean(user?.permisos.some(permission => facturasReadPermissions.includes(permission))),
    queryFn: ({ signal }) => apiFetch<FacturaResumenDto[]>(`/facturas?${billingQuery({ ...filters })}`, { signal }),
  })
}
export function useFactura(id: number | null) {
  const { user } = useSession()
  return useQuery({ queryKey: ['facturas', user?.idUsuario, 'detail', id], retry: false,
    enabled: id !== null && Boolean(user?.permisos.some(permission => facturasReadPermissions.includes(permission))),
    queryFn: async ({ signal }) => (await apiFetch<FacturaDetalleDto>(`/facturas/${id}`, { signal })).data,
  })
}
export function useOrdenesFacturables(filters: { page: number; pageSize: number; search: string }, enabled: boolean) {
  const { user } = useSession()
  return useQuery({ queryKey: ['facturacion-ordenes', user?.idUsuario, filters], retry: false,
    enabled: enabled && Boolean(user?.permisos.includes('FACTURAR')),
    queryFn: ({ signal }) => apiFetch<OrdenResumenDto[]>(`/ordenes?${billingQuery({ ...filters, estado: 'LISTO' })}`, { signal }),
  })
}
export function useOrdenFacturacion(id: number | null, permission: 'FACTURAR' | 'PAGOS_REGISTRAR') {
  const { user } = useSession()
  return useQuery({ queryKey: ['ordenes', user?.idUsuario, 'detail', id], retry: false,
    enabled: id !== null && Boolean(user?.permisos.includes(permission)),
    queryFn: async ({ signal }) => (await apiFetch<OrdenDetalleDto>(`/ordenes/${id}`, { signal })).data,
  })
}
const money = z.string().regex(/^\d+\.\d{2}$/)
const previewSchema = z.object({ subtotalManoObra: money, subtotalRepuestos: money, porcentajeImpuesto: money, impuesto: money, total: money })
function confirmed<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new ApiError('No se pudo confirmar el resultado recibido. Consulta el estado antes de repetir la operación.', 'RESPUESTA_INVALIDA', 0)
  return result.data
}
export function useResumenFacturacion(id: number | null, porcentaje: string | null, enabled: boolean) {
  const { user } = useSession()
  return useQuery({ queryKey: ['facturacion-resumen', user?.idUsuario, id, porcentaje], retry: false, staleTime: 0,
    enabled: enabled && id !== null && porcentaje !== null && Boolean(user?.permisos.includes('FACTURAR')),
    queryFn: async ({ signal }) => confirmed(previewSchema, (await apiFetch<unknown>(`/ordenes/${id}/resumen-facturacion?${billingQuery({ porcentajeImpuesto: porcentaje! })}`, { signal })).data),
  })
}
export function useMetodosPago(enabled: boolean) {
  const { user } = useSession()
  return useQuery({ queryKey: ['facturacion-catalogos', user?.idUsuario], retry: false,
    enabled: enabled && Boolean(user?.permisos.includes('PAGOS_REGISTRAR')),
    queryFn: async ({ signal }): Promise<MetodoPagoOption[]> => {
      const result = await apiFetch<{ metodosPago: { id: number; nombre: string; activo: boolean }[] }>('/catalogos', { signal })
      return result.data.metodosPago.map(item => ({ idMetodoPago: item.id, nombre: item.nombre, activo: item.activo }))
    },
  })
}
export function isUnconfirmed(error: Error | null) {
  return error !== null && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500 || error.code === 'RESPUESTA_INVALIDA')
}
const invoiceResult = z.object({ idFactura: z.number().int().positive(), numeroFactura: z.string().min(1), estado: z.literal('EMITIDA'), saldo: money, total: money })
const paymentResult = z.object({ idPago: z.number().int().positive(), idFactura: z.number().int().positive(), saldo: money, estadoFactura: z.enum(['EMITIDA', 'PAGADA']) })
const cancelResult = z.object({ idPago: z.number().int().positive(), estado: z.literal('ANULADO'), saldo: money, estadoFactura: z.enum(['EMITIDA', 'PAGADA']) })

export function useBillingWrite<TInput, TResult>(send: (input: TInput) => Promise<TResult>, idOrden: number | null) {
  const client = useQueryClient()
  return useMutation({ mutationKey: ['facturacion-write'], retry: false, mutationFn: send,
    onSettled: () => {
      // Refresh even after a lost response or a conflict: the server may have committed.
      for (const key of ['facturas', 'dashboard', 'facturacion-ordenes', 'facturacion-resumen', 'reportes']) void client.invalidateQueries({ queryKey: [key] })
      if (idOrden !== null) {
        void client.invalidateQueries({ queryKey: ['ordenes'] })
        void client.invalidateQueries({ queryKey: ['orden', idOrden] })
      }
    },
  })
}
export async function generarFactura(idOrden: number, body: { nitFacturacion: string | null; nombreFacturacion: string | null; direccionFacturacion: string | null; porcentajeImpuesto: string }) {
  return confirmed(invoiceResult, (await apiFetch<unknown>(`/ordenes/${idOrden}/factura`, { method: 'POST', body: JSON.stringify(body) })).data)
}
export async function registrarPago(idFactura: number, body: { idMetodoPago: number; monto: string; referencia: string | null }) {
  const result = confirmed(paymentResult, (await apiFetch<unknown>(`/facturas/${idFactura}/pagos`, { method: 'POST', body: JSON.stringify(body) })).data)
  if (result.idFactura !== idFactura) throw new ApiError('No se pudo confirmar la factura del pago. Consulta el estado antes de repetirlo.', 'RESPUESTA_INVALIDA', 0)
  return result
}
export async function anularPago(idPago: number, body: { motivo: string }) {
  const result = confirmed(cancelResult, (await apiFetch<unknown>(`/pagos/${idPago}/anular`, { method: 'POST', body: JSON.stringify(body) })).data)
  if (result.idPago !== idPago) throw new ApiError('No se pudo confirmar el pago anulado. Consulta el estado antes de repetirlo.', 'RESPUESTA_INVALIDA', 0)
  return result
}
