import { useState } from 'react'
import { SearchSelect } from '@/components/shared/search-select'
import { ErrorState } from '@/components/shared/states'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useOrdenesFacturables } from './api'
import type { OrdenFacturacion } from './facturacion-schema'

export function OrdenSelector({ selected, onSelect, disabled, error }: {
  selected: OrdenFacturacion | null; onSelect: (orden: OrdenFacturacion | null) => void; disabled: boolean; error?: string
}) {
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const debounced = useDebouncedValue(search.trim())
  const ordenes = useOrdenesFacturables({ page: 1, pageSize, search: debounced }, !disabled)
  const options = (ordenes.data?.data ?? []).filter(orden => orden.estado === 'LISTO')
  const persistent = selected && !options.some(orden => orden.idOrden === selected.idOrden) ? [selected] : []
  return <div className="space-y-3 rounded-lg border p-4">
    <SearchSelect id="facturacion-orden" label="Orden" required disabled={disabled} error={error} selected={selected} rows={[...persistent, ...options]}
      valueOf={orden => orden.idOrden} labelOf={orden => orden.numeroOrden} search={search} placeholder="Busca órdenes listas por número, cliente o serie…"
      loading={!disabled && (ordenes.isFetching || search.trim() !== debounced)}
      hasMore={(ordenes.data?.meta?.total ?? 0) > pageSize && pageSize < 100} onLoadMore={() => setPageSize(size => Math.min(100, size + 20))}
      onSearch={text => { setSearch(text); setPageSize(10) }} onSelect={onSelect} />
    {ordenes.isError && <ErrorState description={ordenes.error.message} onRetry={() => void ordenes.refetch()} />}
  </div>
}
