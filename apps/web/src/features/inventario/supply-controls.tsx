import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/shared/form-fields'
import { SearchSelect } from '@/components/shared/search-select'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { ErrorState } from '@/components/shared/states'
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
    <div className="inline-flex shrink-0 gap-2">
      <Button type="button" size="sm" variant="outline" aria-label={label ? `Anterior ${label}` : 'Anterior'} disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
      <Button type="button" size="sm" variant="outline" aria-label={label ? `Siguiente ${label}` : 'Siguiente'} disabled={busy || page >= (meta?.totalPages ?? 1)} onClick={() => onPage(page + 1)}>Siguiente</Button>
    </div></div>
}
export interface SupplyOption { id: number; nombre: string }
/** Selections persist across server searches/pages; a page is never treated as the whole catalog. */
export function SupplySelector({ resource, label, id, value, selected, onSelect, error, active = false, required = false, disabled = false, options }: {
  resource: 'repuestos' | 'proveedores' | 'bodegas'; label: string; id: string; value: string
  selected?: SupplyOption; onSelect: (option: SupplyOption | undefined) => void; error?: string
  active?: boolean; required?: boolean; disabled?: boolean; options?: readonly SupplyOption[]
}) {
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const debounced = useDebouncedValue(search.trim())
  const query = useSupplyList<Record<string, unknown>>(resource, { search: debounced, page: 1, pageSize, estado: active ? resource === 'bodegas' ? 'ACTIVA' : 'ACTIVO' : undefined }, !disabled && options === undefined)
  const key = resource === 'repuestos' ? 'idRepuesto' : resource === 'bodegas' ? 'idBodega' : 'idProveedor'
  const rows = options ?? query.data?.data.map(row => ({ id: Number(row[key]), nombre: `${row.codigo ? `${row.codigo} · ` : ''}${String(row.nombre)}` })) ?? []
  const persistent = selected && !rows.some(row => row.id === selected.id) ? [selected] : []
  const available = [...persistent, ...rows]
  if (options !== undefined) return <div className="space-y-3 rounded-lg border p-3">
    <SelectField id={id} label={label} value={value} required={required} disabled={disabled} options={available.map(row => ({ value: String(row.id), label: row.nombre }))} placeholder={required ? 'Selecciona una opción' : 'Todos'} error={error} onChange={e => onSelect(available.find(row => String(row.id) === e.target.value))} />
  </div>
  const current = value ? selected ?? available.find(row => String(row.id) === value) ?? null : null
  return <div className="space-y-3 rounded-lg border p-3">
    <SearchSelect id={id} label={label} required={required} disabled={disabled} error={error} selected={current} rows={available}
      valueOf={row => row.id} labelOf={row => row.nombre} search={search} placeholder={`Busca ${label.toLocaleLowerCase('es')} por nombre o código…`}
      loading={!disabled && (query.isFetching || search.trim() !== debounced)}
      hasMore={(query.data?.meta?.total ?? 0) > pageSize && pageSize < 100} onLoadMore={() => setPageSize(size => Math.min(100, size + 20))}
      onSearch={text => { setSearch(text); setPageSize(10) }} onSelect={row => onSelect(row ?? undefined)} />
    {!disabled && query.isError && <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />}
  </div>
}
