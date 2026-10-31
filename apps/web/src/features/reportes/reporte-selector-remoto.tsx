import { useState, type Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { getReportLookup, reportLookupError, type RemoteReportCatalog } from './reporte-lookups'
import type { ReportOption } from './reportes-model'

export function ReporteSelectorRemoto({ id, label, catalog, userId, value, required, error, inputRef, onSelect }: {
  id: string; label: string; catalog: RemoteReportCatalog; userId: number; value: string
  required?: boolean; error?: string; inputRef?: Ref<HTMLSelectElement>; onSelect: (option: ReportOption | null) => void
}) {
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ReportOption | null>(null)
  const query = useQuery({
    queryKey: ['reportes-lookup', userId, catalog, search, page],
    queryFn: ({ signal }) => getReportLookup(catalog, search, page, signal),
    retry: false, staleTime: 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  const options = !query.isFetching && !query.isError ? query.data?.options ?? [] : []
  const pinned = selected?.value === value && !options.some(option => option.value === value) ? [selected] : []
  const selectOptions = [...pinned, ...options]
  function find() {
    const next = draft.trim()
    if (next === search && page === 1) void query.refetch()
    else { setSearch(next); setPage(1) }
  }
  return <div className="space-y-3 rounded-lg border p-3" role="group" aria-label={`Selector de ${label.toLocaleLowerCase('es')}`}>
    <TextField id={`${id}-search`} label={`Buscar ${label.toLocaleLowerCase('es')}`} maxLength={150} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); find() } }} help="Busca por nombre, código o documento y recorre las páginas para elegir." />
    <Button variant="outline" size="sm" onClick={find}>Buscar {label.toLocaleLowerCase('es')}</Button>
    <SelectField ref={inputRef} id={id} label={label} required={required} value={value} options={selectOptions} error={error} placeholder={required ? 'Selecciona una opción' : 'Todos'} help={selected?.value === value ? `Selección: ${selected.label}. Se conserva al cambiar la búsqueda o la página.` : 'Selecciona un registro de los resultados de búsqueda.'} onChange={event => {
      const option = selectOptions.find(item => item.value === event.target.value) ?? null
      setSelected(option)
      onSelect(option)
    }} />
    {query.isFetching && <p role="status" className="text-xs text-muted-foreground">Buscando {catalog}…</p>}
    {query.isError && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{reportLookupError(query.error)}</p><Button variant="outline" size="sm" onClick={() => { void query.refetch() }}>Reintentar búsqueda de {label.toLocaleLowerCase('es')}</Button></div>}
    {!query.isFetching && !query.isError && query.data && <>
      {!options.length && <p className="text-xs text-muted-foreground">No hay coincidencias para esta búsqueda.</p>}
      <nav aria-label={`Páginas de ${label.toLocaleLowerCase('es')}`} className="flex flex-wrap items-center gap-2 text-xs">
        <span>Página {query.data.meta.page} de {Math.max(1, query.data.meta.totalPages)} · {query.data.meta.total} registros</span>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior: {label.toLocaleLowerCase('es')}</Button>
        <Button variant="outline" size="sm" disabled={page >= query.data.meta.totalPages} onClick={() => setPage(page + 1)}>Siguiente: {label.toLocaleLowerCase('es')}</Button>
      </nav>
    </>}
  </div>
}
