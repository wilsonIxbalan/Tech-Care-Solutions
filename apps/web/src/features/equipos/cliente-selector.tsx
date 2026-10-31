import { useState } from 'react'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { useSession } from '@/features/auth/session-context'
import { clientesReadPermissions, useClientes } from '@/features/clientes/api'
import { ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { SearchSelect } from '@/components/shared/search-select'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import type { ClienteDto } from '@/types/domain'

export type ClienteOption = Pick<ClienteDto, 'idCliente' | 'nombreMostrar'>

export function ClienteSelector({ selected, onSelect, registration, error, disabled = false, id = 'equipo-cliente' }: {
  selected: ClienteOption | null; onSelect: (cliente: ClienteOption | null) => void
  registration?: UseFormRegisterReturn; error?: FieldError; disabled?: boolean; id?: string
}) {
  const { user } = useSession()
  const allowed = Boolean(user?.permisos.some(permission => clientesReadPermissions.includes(permission)))
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const debounced = useDebouncedValue(search.trim())
  const clientes = useClientes({ page: 1, pageSize, search: debounced }, !disabled)
  const options = clientes.data?.data ?? []
  const persistent = selected && !options.some(option => option.idCliente === selected.idCliente) ? [selected] : []
  return <div className="space-y-2 rounded-lg border p-3">
    {registration && <input type="hidden" {...registration} value={selected ? String(selected.idCliente) : ''} />}
    <SearchSelect id={id} label="Cliente propietario" required={Boolean(registration)} disabled={!allowed || disabled}
      error={error?.message} placeholder="Busca por nombre, NIT o teléfono…" selected={selected} rows={[...persistent, ...options]}
      valueOf={cliente => cliente.idCliente} labelOf={cliente => cliente.nombreMostrar} search={search}
      loading={allowed && !disabled && (clientes.isFetching || search.trim() !== debounced)}
      hasMore={(clientes.data?.meta?.total ?? 0) > pageSize && pageSize < 100} onLoadMore={() => setPageSize(size => Math.min(100, size + 20))}
      onSearch={text => { setSearch(text); setPageSize(10) }} onSelect={option => {
        onSelect(option)
        void registration?.onChange({ target: { name: registration.name, value: option ? String(option.idCliente) : '' }, type: 'change' })
      }} />
    {!allowed && <p className="text-xs text-muted-foreground">No tienes permiso para consultar clientes. Solicita acceso para seleccionar otro propietario.</p>}
    {!registration && selected && <Button type="button" variant="outline" size="sm" disabled={!allowed || disabled} onClick={() => { onSelect(null); setSearch('') }}>Todos los clientes</Button>}
    {allowed && !disabled && clientes.isError && <ErrorState description={clientes.error.message} onRetry={() => void clientes.refetch()} />}
  </div>
}
