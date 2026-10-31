import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-context'
import { ApiError, apiFetch } from '@/lib/api-client'
import { z } from 'zod'
import { invalidateRelatedQueries } from '@/lib/query-invalidation'
import type { SessionUser } from '@/types/api'
import type { OrdenDetalleDto, OrdenResumenDto } from '@/types/domain'

export const orderStates = ['RECIBIDO', 'DIAGNOSTICO', 'ESPERANDO_AUTORIZACION', 'REPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'] as const
export const orderReadPermissions = ['ORDENES_CREAR', 'DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'REPUESTOS_CONSUMIR', 'FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER']
export function canService(user: SessionUser | null, permission: string, technician = false) {
  return Boolean(user?.permisos.includes(permission) && (!technician || user.roles.includes('TECNICO')))
}
export function serviceQuery(filters: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && String(value).trim() !== '') query.set(key, String(value).trim()) })
  return query.toString()
}
export function useOrdenes(filters: Record<string, string | number | undefined>, enabled = true) {
  const { user } = useSession()
  return useQuery({ queryKey: ['ordenes', user?.idUsuario, filters], placeholderData: keepPreviousData, retry: false,
    enabled: enabled && Boolean(user?.permisos.some(permission => orderReadPermissions.includes(permission))),
    queryFn: ({ signal }) => apiFetch<OrdenResumenDto[]>(`/ordenes?${serviceQuery(filters)}`, { signal }),
  })
}
export function useOrden(id?: number) {
  const { user } = useSession()
  return useQuery({ queryKey: ['ordenes', user?.idUsuario, 'detalle', id], retry: false,
    enabled: Boolean(id && user?.permisos.some(permission => orderReadPermissions.includes(permission))),
    queryFn: ({ signal }) => apiFetch<OrdenDetalleDto>(`/ordenes/${id}`, { signal }),
  })
}
export interface ServiceCatalogos {
  prioridades: { id: number; nombre: string }[]
  tecnicos: { id: number; nombre: string }[]
}
export function useServiceCatalogos() {
  const { user } = useSession()
  return useQuery({ queryKey: ['ordenes', 'catalogos', user?.idUsuario], enabled: Boolean(user), retry: false,
    queryFn: ({ signal }) => apiFetch<ServiceCatalogos>('/catalogos', { signal }),
  })
}
export function useServiceMutation<T = Record<string, unknown>>(path: string) {
  const client = useQueryClient()
  const invalidate = () => invalidateRelatedQueries(client, 'service')
  return useMutation({ retry: false,
    mutationFn: async (body: unknown) => {
      const result = await apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
      validateServiceResult(path, result.data)
      return result
    },
    onSuccess: async () => {
      await invalidate()
    },
    onError: async (error) => {
      if (error instanceof ApiError && (error.status === 0 || error.status === 409 || error.status >= 500 || error.code === 'RESPUESTA_INVALIDA')) await invalidate()
    },
  })
}

const resultId = z.number().int().positive().max(2147483647)
const resultState = z.enum(orderStates)
export function validateServiceResult(path: string, data: unknown) {
  const schema = path === '/ordenes' ? z.object({ idOrden: resultId, numeroOrden: z.string().min(1), estado: resultState })
    : path.endsWith('/diagnostico') ? z.object({ idDiagnostico: resultId, idOrden: resultId, estadoOrden: resultState })
      : path.endsWith('/reparaciones') ? z.object({ idReparacion: resultId, idOrden: resultId, estado: z.enum(['EN_PROCESO', 'FINALIZADA', 'CANCELADA']), estadoOrden: resultState })
        : path.endsWith('/finalizar') ? z.object({ idReparacion: resultId, estado: z.enum(['EN_PROCESO', 'FINALIZADA', 'CANCELADA']), estadoOrden: resultState })
          : path.endsWith('/actividades') ? z.object({ idActividad: resultId })
            : path.endsWith('/repuestos') ? z.object({ idRepuestoReparacion: resultId, existenciaResultante: z.number().int().min(0).max(2147483647) })
              : path.endsWith('/estado') ? z.object({ idOrden: resultId, estado: resultState })
                : z.object({ idEntrega: resultId, idOrden: resultId, estadoOrden: resultState })
  if (!schema.safeParse(data).success) throw new ApiError('No se pudo verificar la respuesta de la operación. Consulta el estado antes de repetirla.', 'RESPUESTA_INVALIDA', 200)
}
