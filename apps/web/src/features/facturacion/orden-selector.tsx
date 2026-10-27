import { useState } from 'react'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { useOrdenesFacturables } from './api'
import type { OrdenFacturacion } from './facturacion-schema'

export function OrdenSelector({ selected, onSelect, disabled, error }: {
  selected: OrdenFacturacion | null; onSelect: (orden: OrdenFacturacion | null) => void; disabled: boolean; error?: string
}) {
  const [filters, setFilters] = useState({ page: 1, pageSize: 10, search: '' })
  const ordenes = useOrdenesFacturables(filters, !disabled)
  const options = (ordenes.data?.data ?? []).filter(orden => orden.estado === 'LISTO')
  const persistent = selected && !options.some(orden => orden.idOrden === selected.idOrden) ? [selected] : []
  return <div className="space-y-3 rounded-lg border p-4">
    <TextField id="facturacion-buscar-orden" label="Buscar orden lista" type="search" placeholder="Número, cliente o serie" maxLength={150} value={filters.search} disabled={disabled} onChange={event => setFilters({ ...filters, search: event.target.value, page: 1 })} />
    <SelectField id="facturacion-orden" label="Orden" required value={selected ? String(selected.idOrden) : ''} disabled={disabled || ordenes.isFetching || ordenes.isError} options={[...persistent, ...options].map(orden => ({ value: String(orden.idOrden), label: orden.numeroOrden }))} help="Selecciona una orden LISTO. La selección se conserva al buscar o cambiar de página." error={error} onChange={event => onSelect([...persistent, ...options].find(orden => String(orden.idOrden) === event.target.value) ?? null)} />
    {ordenes.isPending ? <LoadingState label="Consultando órdenes…" /> : ordenes.isError ? <ErrorState description={ordenes.error.message} onRetry={() => void ordenes.refetch()} /> : <>
      {!options.length && <p className="text-sm text-muted-foreground">Sin órdenes listas para esta búsqueda.</p>}
      <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" size="sm" disabled={disabled || ordenes.isFetching || filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Órdenes anteriores</Button><span className="text-sm text-muted-foreground">Página {filters.page} de {Math.max(1, ordenes.data.meta?.totalPages ?? 1)}</span><Button type="button" variant="outline" size="sm" disabled={disabled || ordenes.isFetching || filters.page >= (ordenes.data.meta?.totalPages ?? 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Más órdenes</Button></div>
    </>}
  </div>
}
