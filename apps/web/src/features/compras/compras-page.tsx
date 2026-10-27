import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-context'
import { PageHeader } from '@/components/shared/page-header'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { formatMoney, formatUtcDateTime } from '@/lib/format'
import { apiFetch } from '@/lib/api-client'
import { formatCivilDate } from '@/lib/format'
import type { ReceivedData } from '@/lib/received-data'
import type { CompraDetalleDto, CompraResumenDto } from '@/types/domain'
import { listState, useSupplyAccess, useSupplyList } from '@/features/inventario/api'
import { SupplyPagination, SupplySelector } from '@/features/inventario/supply-controls'
import type { SupplyOption } from '@/features/inventario/supply-controls'
import { CompraForm } from './compra-form'
import { CompraDetalle } from './compra-detalle'
import { RecibirCompra } from './recibir-compra'
import type { CompraCatalogos } from './compra-schema'

export function ComprasPage({ catalogos = {}, compras, detalle, detalles }: { catalogos?: CompraCatalogos; compras?: ReceivedData<CompraResumenDto>; detalle?: CompraDetalleDto; detalles?: ReceivedData<CompraDetalleDto> }) {
  const { user } = useSession()
  const access = useSupplyAccess()
  const [idCompra, setIdCompra] = useState(detalle?.idCompra ?? 0)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<{ proveedor?: SupplyOption; bodega?: SupplyOption }>({})
  const [filters, setFilters] = useState({ search: '', estado: '', idProveedor: '', idBodegaDestino: '', fechaDesde: '', fechaHasta: '', page: 1, pageSize: 20 })
  const datesValid = (!filters.fechaDesde || formatCivilDate(filters.fechaDesde) !== '—') && (!filters.fechaHasta || formatCivilDate(filters.fechaHasta) !== '—') && (!filters.fechaDesde || !filters.fechaHasta || filters.fechaDesde <= filters.fechaHasta)
  const query = useSupplyList<CompraResumenDto>('compras', filters, compras === undefined && datesValid)
  const detailQuery = useQuery({ queryKey: ['compras', 'detalle', user?.idUsuario, idCompra], retry: false, enabled: access.purchases && idCompra > 0 && !detalle && !detalles,
    queryFn: ({ signal }) => apiFetch<CompraDetalleDto>(`/compras/${idCompra}`, { signal }),
  })
  const selectedDetail = detalle?.idCompra === idCompra ? detalle : detalles?.status === 'success' ? detalles.data.find(c => c.idCompra === idCompra) : detailQuery.data?.data
  if (!access.purchases) return <EmptyState title="Acceso restringido" description="No tienes permiso para gestionar compras." />
  return <><PageHeader title="Compras" description="Registro de compras y recepción completa en bodega." actions={<Button disabled={creating} onClick={() => setCreating(true)}>Nueva compra</Button>} />
    {creating && <CompraForm catalogos={catalogos} onCancel={() => setCreating(false)} onSaved={id => { setCreating(false); setIdCompra(id) }} />}
    <section className="space-y-4" aria-label="Listado de compras"><div className="grid gap-4 sm:grid-cols-3">
      <TextField id="compras-search" label="Buscar compras" type="search" maxLength={150} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
      <SelectField id="compras-estado" label="Estado de compra" placeholder="Todos" options={['PENDIENTE', 'RECIBIDA', 'ANULADA'].map(value => ({ value, label: value }))} value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value, page: 1 })} />
      <SupplySelector resource="proveedores" id="compras-proveedor" label="Proveedor" value={filters.idProveedor} selected={selected.proveedor} onSelect={option => { setSelected({ ...selected, proveedor: option }); setFilters({ ...filters, idProveedor: option ? String(option.id) : '', page: 1 }) }} />
      <SupplySelector resource="bodegas" id="compras-bodega" label="Bodega destino" value={filters.idBodegaDestino} selected={selected.bodega} onSelect={option => { setSelected({ ...selected, bodega: option }); setFilters({ ...filters, idBodegaDestino: option ? String(option.id) : '', page: 1 }) }} />
      <TextField id="compras-desde" label="Fecha desde" type="date" value={filters.fechaDesde} onChange={e => setFilters({ ...filters, fechaDesde: e.target.value, page: 1 })} />
      <TextField id="compras-hasta" label="Fecha hasta (inclusive)" type="date" value={filters.fechaHasta} onChange={e => setFilters({ ...filters, fechaHasta: e.target.value, page: 1 })} />
    </div>
    {!datesValid ? <p role="alert">Indica un intervalo de fechas válido.</p> : <><ReceivedTable state={listState(query, compras)} caption="Compras" rowKey={c => c.idCompra} columns={[
      { title: 'Compra', cell: c => c.numeroCompra }, { title: 'Proveedor', cell: c => c.proveedorNombre }, { title: 'Bodega', cell: c => c.bodegaNombre },
      { title: 'Fecha (UTC)', cell: c => formatUtcDateTime(c.fechaCompra) }, { title: 'Estado', cell: c => c.estado }, { title: 'Total del servidor (Q)', cell: c => formatMoney(c.total) },
      { title: 'Acciones', cell: c => <Button variant="outline" onClick={() => setIdCompra(c.idCompra)} aria-label={`Ver ${c.numeroCompra}`}>Ver detalle</Button> },
    ]} />
    {query.isError && <Button variant="outline" onClick={() => void query.refetch()}>Reintentar consulta</Button>}
    {!compras && <SupplyPagination label="compras" page={filters.page} meta={query.data?.meta} busy={query.isFetching} onPage={page => setFilters({ ...filters, page })} />}</>}
    </section>
    <section className="space-y-3" aria-label="Detalle de compra"><h2 className="text-lg font-semibold">Detalle de compra</h2>
      {!idCompra ? <p>Selecciona una compra para consultar su detalle.</p> : selectedDetail ? <><CompraDetalle compra={selectedDetail} /><RecibirCompra key={selectedDetail.idCompra} compra={selectedDetail} /></>
        : detailQuery.isError ? <ErrorState description={detailQuery.error.message} onRetry={() => void detailQuery.refetch()} />
        : detalles?.status === 'error' ? <ErrorState description={detalles.message} />
        : detalles || detalle ? <EmptyState title="Detalle no disponible" description="No se incluyó el detalle seleccionado." /> : <LoadingState label="Consultando compra…" />}
      {idCompra > 0 && !detalle && !detalles && <Button variant="outline" disabled={detailQuery.isFetching} onClick={() => void detailQuery.refetch()}>Actualizar detalle</Button>}
    </section></>
}
