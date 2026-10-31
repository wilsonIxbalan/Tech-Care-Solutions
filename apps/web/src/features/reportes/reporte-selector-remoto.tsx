import { useState, type Ref } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SearchSelect } from '@/components/shared/search-select'
import { Button } from '@/components/ui/button'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { getReportLookup, reportLookupError, type RemoteReportCatalog } from './reporte-lookups'
import type { ReportOption } from './reportes-model'

export function ReporteSelectorRemoto({ id, label, catalog, userId, value, required, error, onSelect }: {
  id: string; label: string; catalog: RemoteReportCatalog; userId: number; value: string
  required?: boolean; error?: string; inputRef?: Ref<HTMLSelectElement>; onSelect: (option: ReportOption | null) => void
}) {
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState<ReportOption | null>(null)
  const debounced = useDebouncedValue(search.trim())
  const query = useQuery({
    queryKey: ['reportes-lookup', userId, catalog, debounced, pageSize],
    queryFn: ({ signal }) => getReportLookup(catalog, debounced, 1, signal, pageSize),
    placeholderData: keepPreviousData,
    retry: false, staleTime: 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  const options = !query.isError ? query.data?.options ?? [] : []
  const current = value && selected?.value === value ? selected : null
  const pinned = current && !options.some(option => option.value === value) ? [current] : []
  const lower = label.toLocaleLowerCase('es')
  return <div className="space-y-2 rounded-lg border p-3" role="group" aria-label={`Selector de ${lower}`}>
    <SearchSelect id={id} label={label} required={required} error={error} selected={current} rows={[...pinned, ...options]}
      valueOf={option => option.value} labelOf={option => option.label} search={search} placeholder={`Busca ${lower} por nombre, código o documento…`}
      loading={query.isFetching || search.trim() !== debounced}
      hasMore={(query.data?.meta.total ?? 0) > pageSize && pageSize < 100} onLoadMore={() => setPageSize(size => Math.min(100, size + 20))}
      onSearch={text => { setSearch(text); setPageSize(20) }}
      onSelect={option => { setSelected(option); onSelect(option) }} />
    {query.isError && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{reportLookupError(query.error)}</p><Button variant="outline" size="sm" onClick={() => { void query.refetch() }}>Reintentar búsqueda de {lower}</Button></div>}
  </div>
}
