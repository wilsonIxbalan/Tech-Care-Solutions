import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateRelatedQueries } from '@/lib/query-invalidation'
import { useSession } from '@/features/auth/session-context'
import { ApiError, apiFetch } from '@/lib/api-client'
import type { ReceivedData } from '@/lib/received-data'
import type { ApiResponse } from '@/types/api'
import type { CategoriaOption } from '@/features/repuestos/repuesto-model'

export const stockReadPermissions = ['INVENTARIO_GESTIONAR', 'REPUESTOS_CONSUMIR', 'COMPRAS_GESTIONAR', 'REPORTES_VER']
export const supplierReadPermissions = ['PROVEEDORES_GESTIONAR', 'COMPRAS_GESTIONAR', 'REPORTES_VER']
export type ListFilters = Record<string, string | number | boolean | undefined>
export function queryString(filters: ListFilters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  return params.toString()
}
export function useSupplyAccess() {
  const { user } = useSession()
  const has = (permissions: readonly string[]) => Boolean(user?.permisos.some(p => permissions.includes(p)))
  return { stockRead: has(stockReadPermissions), supplierRead: has(supplierReadPermissions),
    partsWrite: Boolean(user?.roles.some(role => role === 'ADMINISTRADOR' || role === 'BODEGA')),
    supplierWrite: has(['PROVEEDORES_GESTIONAR']), purchases: has(['COMPRAS_GESTIONAR']), inventoryWrite: has(['INVENTARIO_GESTIONAR']) }
}
export function useSupplyList<T>(resource: string, filters: ListFilters, enabled = true) {
  const { user } = useSession()
  const permissions = resource === 'proveedores' ? supplierReadPermissions : resource === 'compras' ? ['COMPRAS_GESTIONAR'] : stockReadPermissions
  return useQuery({ queryKey: [resource, user?.idUsuario, filters], placeholderData: keepPreviousData, retry: false,
    enabled: enabled && Boolean(user?.permisos.some(p => permissions.includes(p))),
    queryFn: async ({ signal }) => {
      const response = await apiFetch<T[]>(`/${resource}?${queryString(filters)}`, { signal })
      if (!Array.isArray(response.data) || !response.meta) throw new ApiError('La lista no incluye datos y paginación válidos.', 'RESPUESTA_INVALIDA', 200)
      return response
    },
  })
}
export function useSupplyCatalogs(enabled = true) {
  const { user } = useSession()
  return useQuery({ queryKey: ['abastecimiento-catalogos', user?.idUsuario], retry: false, enabled: Boolean(user) && enabled,
    queryFn: async ({ signal }) => {
      const { data } = await apiFetch<{ categoriasRepuesto: { id: number; nombre: string }[]; tiposMovimiento: { codigo: string; nombre: string }[] }>('/catalogos', { signal })
      return { categorias: data.categoriasRepuesto.map((c): CategoriaOption => ({ idCategoria: c.id, nombre: c.nombre })), tipos: data.tiposMovimiento }
    },
  })
}
export function ambiguousResult(error: Error | null) {
  return Boolean(error && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500 || error.code === 'RESPUESTA_INVALIDA'))
}
export function confirmed(condition: unknown): asserts condition {
  if (!condition) throw new ApiError('El servidor no confirmó el resultado esperado. Consulta el estado antes de repetir la operación.', 'RESPUESTA_INVALIDA', 200)
}
export function useSupplyMutation<TBody, TResult>(path: string, method: 'POST' | 'PATCH', successMessage: string, validate: (data: TResult) => void) {
  const client = useQueryClient()
  return useMutation({ retry: false,
    mutationFn: async (body: TBody) => {
      const response = await apiFetch<TResult>(path, { method, body: JSON.stringify(body) })
      validate(response.data)
      return response.data
    },
    onSuccess: () => { toast.success(successMessage) },
    // A lost response may still have committed: invalidate on error as well, never retry a write.
    onSettled: () => {
      void invalidateRelatedQueries(client, 'supply')
    },
  })
}
export function listState<T>(query: { isPending: boolean; isError: boolean; error: Error | null; data?: ApiResponse<T[]> }, supplied?: ReceivedData<T>): ReceivedData<T> {
  if (supplied) return supplied
  if (query.isPending) return { status: 'loading' }
  if (query.isError) return { status: 'error', message: query.error?.message ?? 'No se pudo consultar.' }
  return { status: 'success', data: query.data?.data ?? [] }
}
