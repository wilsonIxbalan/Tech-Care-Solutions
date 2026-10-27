import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-context'
import { listQuery } from '@/features/clientes/api'
import type { ClienteFilters } from '@/features/clientes/api'
import { apiFetch } from '@/lib/api-client'
import type { EquipoDto } from '@/types/domain'
import type { EquipoFormValues } from './equipo-schema'

export const equiposReadPermissions = ['EQUIPOS_GESTIONAR', 'ORDENES_CREAR', 'DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'FACTURAR', 'ENTREGAR_ORDEN', 'REPORTES_VER']
export function useEquipos(filters: ClienteFilters & { idCliente?: number }) {
  const { user } = useSession()
  return useQuery({ queryKey: ['equipos', user?.idUsuario, filters], retry: false,
    enabled: Boolean(user?.permisos.some(permission => equiposReadPermissions.includes(permission))),
    queryFn: ({ signal }) => apiFetch<EquipoDto[]>(`/equipos?${listQuery(filters)}`, { signal }),
  })
}

export function useEquipoCatalogos(enabled: boolean) {
  const { user } = useSession()
  return useQuery({ queryKey: ['equipos', 'catalogos', user?.idUsuario], enabled: Boolean(user) && enabled, retry: false,
    queryFn: async ({ signal }) => {
      const { data } = await apiFetch<{ tiposEquipo: { id: number; nombre: string }[]; marcas: { id: number; nombre: string }[] }>('/catalogos', { signal })
      return {
        tiposEquipo: data.tiposEquipo.map(tipo => ({ idTipoEquipo: tipo.id, nombre: tipo.nombre })),
        marcas: data.marcas.map(marca => ({ idMarca: marca.id, nombre: marca.nombre })),
      }
    },
  })
}

export function equipoBody(values: EquipoFormValues, estado: EquipoDto['estado']) {
  return { idCliente: values.idCliente, idTipoEquipo: values.idTipoEquipo, idMarca: values.idMarca,
    modelo: values.modelo, numeroSerie: values.numeroSerie, descripcion: values.descripcion, estado }
}

export function useSaveEquipo(id?: number) {
  const client = useQueryClient()
  return useMutation({ retry: false,
    mutationFn: (body: ReturnType<typeof equipoBody>) => apiFetch<EquipoDto>(id ? `/equipos/${id}` : '/equipos', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['equipos'] })
      void client.invalidateQueries({ queryKey: ['clientes'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
