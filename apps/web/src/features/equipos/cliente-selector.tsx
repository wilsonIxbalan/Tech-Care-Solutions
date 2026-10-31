import { useState } from 'react'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { useSession } from '@/features/auth/session-context'
import { clientesReadPermissions, useClientes } from '@/features/clientes/api'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { SearchSelect } from '@/components/shared/search-select'
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
    {registration && <input type="hidden" {...registration} value={selected ? String(selected.idCliente) : ''} />}
    <SearchSelect id={id} label="Cliente propietario" required={Boolean(registration)} disabled={!allowed || disabled}
      error={error?.message} placeholder="Nombre, NIT o teléfono" selected={selected} rows={[...persistent, ...options]}
      valueOf={cliente => cliente.idCliente} labelOf={cliente => cliente.nombreMostrar} search={filters.search}
      onSearch={search => setFilters({ ...filters, search, page: 1 })} onSelect={option => {
        onSelect(option)
        void registration?.onChange({ target: { name: registration.name, value: option ? String(option.idCliente) : '' }, type: 'change' })
      }} />
    {!allowed && <p className="text-xs text-muted-foreground">No tienes permiso para consultar clientes. Solicita acceso para seleccionar otro propietario.</p>}
    {!registration && selected && <Button type="button" variant="outline" size="sm" disabled={!allowed || disabled} onClick={() => { onSelect(null); setFilters({ ...filters, search: '', page: 1 }) }}>Todos los clientes</Button>}
    {allowed && !disabled && (clientes.isPending ? <LoadingState label="Buscando clientes…" /> : clientes.isError ? <ErrorState description={clientes.error.message} onRetry={() => void clientes.refetch()} /> : <>
      {!options.length && <p className="text-xs text-muted-foreground">Sin clientes para esta búsqueda.</p>}
      <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={filters.page <= 1 || clientes.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Clientes anteriores</Button><span className="text-xs text-muted-foreground">Página {filters.page} de {Math.max(1, clientes.data.meta?.totalPages ?? 1)}</span><Button type="button" size="sm" variant="outline" disabled={filters.page >= (clientes.data.meta?.totalPages ?? 1) || clientes.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Más clientes</Button></div>
    </>)}
  </div>
}
