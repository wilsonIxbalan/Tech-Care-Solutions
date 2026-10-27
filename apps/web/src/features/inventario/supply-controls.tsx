import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { ApiError } from '@/lib/api-client'
import type { ApiResponse } from '@/types/api'
import { ambiguousResult, useSupplyList } from './api'

export function SupplyError({ error }: { error: Error | null }) {
  if (!error) return null
  return <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm">
    <p>{error.message}</p>
    {error instanceof ApiError && error.details && <ul>{Object.entries(error.details).flatMap(([field, messages]) => messages.map((message, index) => <li key={`${field}-${index}`}>{field}: {message}</li>))}</ul>}
    {ambiguousResult(error) && <p>Resultado no confirmado. Consulta el listado y los movimientos antes de repetir la operación. No se reenviará automáticamente.</p>}
    {error instanceof ApiError && error.requestId && <p>Referencia: {error.requestId}</p>}
  </div>
}
export function SupplyPagination({ meta, page, onPage, busy = false, label = '' }: { meta?: ApiResponse<unknown>['meta']; page: number; onPage: (page: number) => void; busy?: boolean; label?: string }) {
  return <div className="flex flex-wrap items-center gap-3"><span aria-live="polite" className="text-sm">{meta?.total ?? 0} {label} · Página {page} de {Math.max(1, meta?.totalPages ?? 1)}</span>
    <Button type="button" size="sm" variant="outline" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>Anterior {label}</Button>
    <Button type="button" size="sm" variant="outline" disabled={busy || page >= (meta?.totalPages ?? 1)} onClick={() => onPage(page + 1)}>Siguiente {label}</Button></div>
}
export interface SupplyOption { id: number; nombre: string }
/** Selections persist across server searches/pages; a page is never treated as the whole catalog. */
export function SupplySelector({ resource, label, id, value, selected, onSelect, error, active = false, required = false, disabled = false, options }: {
  resource: 'repuestos' | 'proveedores' | 'bodegas'; label: string; id: string; value: string
  selected?: SupplyOption; onSelect: (option: SupplyOption | undefined) => void; error?: string
  active?: boolean; required?: boolean; disabled?: boolean; options?: readonly SupplyOption[]
}) {
  const [filters, setFilters] = useState({ search: '', page: 1, pageSize: 10 })
  const query = useSupplyList<Record<string, unknown>>(resource, { ...filters, estado: active ? resource === 'bodegas' ? 'ACTIVA' : 'ACTIVO' : undefined }, !disabled && options === undefined)
  const key = resource === 'repuestos' ? 'idRepuesto' : resource === 'bodegas' ? 'idBodega' : 'idProveedor'
  const rows = options ?? query.data?.data.map(row => ({ id: Number(row[key]), nombre: `${row.codigo ? `${row.codigo} · ` : ''}${String(row.nombre)}` })) ?? []
  const persistent = selected && !rows.some(row => row.id === selected.id) ? [selected] : []
  const available = [...persistent, ...rows]
  return <div className="space-y-3 rounded-lg border p-3">
    {options === undefined && <TextField id={`${id}-search`} label={`Buscar ${label.toLocaleLowerCase()}`} type="search" maxLength={150} disabled={disabled} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />}
    <SelectField id={id} label={label} value={value} required={required} disabled={disabled} options={available.map(row => ({ value: String(row.id), label: row.nombre }))} placeholder={required ? 'Selecciona una opción' : 'Todos'} error={error} onChange={e => onSelect(available.find(row => String(row.id) === e.target.value))} />
    {options === undefined && !disabled && (query.isPending ? <LoadingState label={`Consultando ${label.toLowerCase()}…`} /> : query.isError ? <ErrorState description={query.error.message} onRetry={() => void query.refetch()} /> : <SupplyPagination label={label.toLowerCase()} page={filters.page} meta={query.data.meta} busy={query.isFetching} onPage={page => setFilters({ ...filters, page })} />)}
  </div>
}
