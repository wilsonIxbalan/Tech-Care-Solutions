import { useState } from 'react'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { useSession } from '@/features/auth/session-context'
import { clientesReadPermissions, useClientes } from '@/features/clientes/api'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { ClienteDto } from '@/types/domain'

export type ClienteOption = Pick<ClienteDto, 'idCliente' | 'nombreMostrar'>

export function ClienteSelector({ selected, onSelect, registration, error, disabled = false, id = 'equipo-cliente' }: {
  selected: ClienteOption | null; onSelect: (cliente: ClienteOption | null) => void
  registration?: UseFormRegisterReturn; error?: FieldError; disabled?: boolean; id?: string
}) {
  const { user } = useSession()
  const allowed = Boolean(user?.permisos.some(permission => clientesReadPermissions.includes(permission)))
  const [filters, setFilters] = useState({ page: 1, pageSize: 10, search: '' })
  const clientes = useClientes(filters, !disabled)
  const options = clientes.data?.data ?? []
  const persistent = selected && !options.some(option => option.idCliente === selected.idCliente) ? [selected] : []
  return <div className="space-y-2 rounded-lg border p-3">
    <Label htmlFor={`${id}-search`}>Buscar cliente propietario</Label>
    <Input id={`${id}-search`} type="search" maxLength={150} placeholder="Nombre, NIT o teléfono" value={filters.search} disabled={!allowed || disabled} onChange={event => setFilters({ ...filters, search: event.target.value, page: 1 })} />
    <Label htmlFor={id}>Cliente propietario{registration ? ' *' : ''}</Label>
    <NativeSelect {...registration} id={id} value={selected ? String(selected.idCliente) : ''} required={Boolean(registration)} disabled={!allowed || disabled} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={event => {
      const option = [...persistent, ...options].find(cliente => String(cliente.idCliente) === event.target.value) ?? null
      onSelect(option)
      void registration?.onChange(event)
    }}>
      <option value="">{registration ? 'Selecciona un cliente' : 'Todos los clientes'}</option>
      {[...persistent, ...options].map(cliente => <option key={cliente.idCliente} value={cliente.idCliente}>{cliente.nombreMostrar}</option>)}
    </NativeSelect>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{!allowed ? 'No tienes permiso para consultar clientes. Solicita acceso para seleccionar otro propietario.' : 'Busca entre todos los clientes. La selección se conserva al cambiar la búsqueda o página.'}</p>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error.message}</p>}
    {allowed && !disabled && (clientes.isPending ? <LoadingState label="Buscando clientes…" /> : clientes.isError ? <ErrorState description={clientes.error.message} onRetry={() => void clientes.refetch()} /> : <>
      {!options.length && <p className="text-xs text-muted-foreground">Sin clientes para esta búsqueda.</p>}
      <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={filters.page <= 1 || clientes.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Clientes anteriores</Button><span className="text-xs text-muted-foreground">Página {filters.page} de {Math.max(1, clientes.data.meta?.totalPages ?? 1)}</span><Button type="button" size="sm" variant="outline" disabled={filters.page >= (clientes.data.meta?.totalPages ?? 1) || clientes.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Más clientes</Button></div>
    </>)}
  </div>
}
