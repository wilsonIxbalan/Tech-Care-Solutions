import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-context'
import { apiFetch } from '@/lib/api-client'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { Button } from '@/components/ui/button'
import { SearchSelect } from '@/components/shared/search-select'
import { TextField, SelectField } from '@/components/shared/form-fields'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { serviceQuery } from './api'

export function ApiSelector<T>({ path, label, selected, onSelect, valueOf, labelOf, filters = {}, disabled = false, error, searchable = false }: {
  path: string; label: string; selected: T | null; onSelect: (value: T | null) => void
  valueOf: (value: T) => number | string; labelOf: (value: T) => string
  filters?: Record<string, string | number | undefined>; disabled?: boolean; error?: string; searchable?: boolean
}) {
  const { user } = useSession()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const debounced = useDebouncedValue(search.trim())
  const size = searchable ? pageSize : 10
  const query = useQuery({ queryKey: [path.slice(1), 'selector', user?.idUsuario, filters, page, size, debounced], retry: false, enabled: Boolean(user) && !disabled,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => apiFetch<T[]>(`${path}?${serviceQuery({ ...filters, page, pageSize: size, search: debounced })}`, { signal }),
  })
  const rows = query.data?.data ?? []
  const options = selected && !rows.some(row => valueOf(row) === valueOf(selected)) ? [selected, ...rows] : rows
  return <div className="space-y-3 rounded-lg border p-3">
    {searchable ? <SearchSelect id={`${label}-select`} label={label} required disabled={disabled} error={error}
      selected={selected} rows={options} valueOf={valueOf} labelOf={labelOf} search={search}
      placeholder={`Busca ${label.toLowerCase()}…`} loading={!disabled && (query.isFetching || search.trim() !== debounced)}
      hasMore={(query.data?.meta?.total ?? 0) > pageSize && pageSize < 100} onLoadMore={() => setPageSize(current => Math.min(100, current + 20))}
      onSearch={value => { setSearch(value); setPage(1); setPageSize(10) }} onSelect={onSelect} /> : <>
      <TextField id={`${label}-search`} label={`Buscar ${label.toLowerCase()}`} type="search" placeholder={`Escribe para buscar ${label.toLowerCase()}…`} autoComplete="off" maxLength={150} value={search} disabled={disabled} onChange={event => { setSearch(event.target.value); setPage(1) }} />
      <SelectField id={`${label}-select`} label={label} required disabled={disabled} error={error} help="La selección se conserva al buscar o cambiar de página." value={selected ? String(valueOf(selected)) : ''}
        options={options.map(row => ({ value: String(valueOf(row)), label: labelOf(row) }))}
        onChange={event => onSelect(options.find(row => String(valueOf(row)) === event.target.value) ?? null)} />
    </>}
    {!disabled && (searchable ? query.isError && <ErrorState description={query.error.message} onRetry={() => void query.refetch()} /> : query.isPending ? <LoadingState label={`Buscando ${label.toLowerCase()}…`} /> : query.isError ? <ErrorState description={query.error.message} onRetry={() => void query.refetch()} /> : <>
      {!rows.length && <p>Sin resultados para esta búsqueda.</p>}
      <div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>{label}: anteriores</Button><span>Página {page} de {Math.max(1, query.data.meta?.totalPages ?? 1)}</span><Button type="button" size="sm" variant="outline" disabled={page >= (query.data.meta?.totalPages ?? 1) || query.isFetching} onClick={() => setPage(page + 1)}>{label}: siguientes</Button></div>
    </>)}
  </div>
}
