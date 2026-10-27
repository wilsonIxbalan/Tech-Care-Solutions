import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-context'
import { apiFetch } from '@/lib/api-client'
import type { ClienteDto } from '@/types/domain'
import type { ClienteFormValues } from './cliente-schema'

export const clientesReadPermissions = ['CLIENTES_GESTIONAR', 'ORDENES_CREAR', 'DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER']
export interface ClienteFilters { page: number; pageSize: number; search: string; estado?: string }

export function listQuery(filters: ClienteFilters & { idCliente?: number }) {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) })
  if (filters.search.trim()) query.set('search', filters.search.trim())
  if (filters.estado) query.set('estado', filters.estado)
  if (filters.idCliente) query.set('idCliente', String(filters.idCliente))
  return query
}

export function useClientes(filters: ClienteFilters, enabled = true) {
  const { user } = useSession()
  const allowed = Boolean(user?.permisos.some(permission => clientesReadPermissions.includes(permission)))
  return useQuery({
    queryKey: ['clientes', user?.idUsuario, filters], enabled: allowed && enabled, retry: false,
    queryFn: ({ signal }) => apiFetch<ClienteDto[]>(`/clientes?${listQuery(filters)}`, { signal }),
  })
}

export function clienteBody(values: ClienteFormValues, estado: ClienteDto['estado']) {
  return {
    tipoCliente: values.tipoCliente, nit: values.nit, telefono: values.telefono, estado,
    nombres: values.tipoCliente === 'INDIVIDUAL' ? values.nombres : null,
    apellidos: values.tipoCliente === 'INDIVIDUAL' ? values.apellidos : null,
    razonSocial: values.tipoCliente === 'EMPRESARIAL' ? values.razonSocial : null,
    nombreContacto: values.tipoCliente === 'EMPRESARIAL' ? values.nombreContacto || null : null,
    email: values.email || null, direccion: values.direccion || null,
  }
}

export function useSaveCliente(id?: number) {
  const client = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (body: ReturnType<typeof clienteBody>) => apiFetch<ClienteDto>(id ? `/clientes/${id}` : '/clientes', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['clientes'] })
      void client.invalidateQueries({ queryKey: ['equipos'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
