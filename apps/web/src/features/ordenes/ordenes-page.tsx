import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/page-header'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { TextField, SelectField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { useSession } from '@/features/auth/session-context'
import { formatUtcDateTime } from '@/lib/format'
import type { OrdenCatalogos } from './orden-catalogos'
import { OrdenForm } from './orden-form'
import { canService, orderStates, useOrdenes, useServiceCatalogos } from './api'

export function OrdenList({ initialState = '', title = 'Órdenes' }: { initialState?: string; title?: string }) {
  const [filters, setFilters] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, search: '', estado: initialState, idCliente: '', idEquipo: '', idPrioridad: '', idTecnico: '', fechaDesde: '', fechaHasta: '' })
  const validDates = !filters.fechaDesde || !filters.fechaHasta || filters.fechaDesde <= filters.fechaHasta
  const orders = useOrdenes(filters, validDates)
  const catalogos = useServiceCatalogos()
  const change = (key: keyof typeof filters, value: string) => setFilters({ ...filters, [key]: value, page: 1 })
  return <section className="space-y-4" aria-label={title}>
    <h2 className="text-xl font-semibold">{title}</h2>
    <div className="grid gap-3 md:grid-cols-3">
      <TextField id={`${title}-search`} label="Buscar orden" type="search" maxLength={150} value={filters.search} onChange={e => change('search', e.target.value)} />
      <SelectField id={`${title}-estado`} label="Estado" placeholder="Todos" options={orderStates.map(value => ({ value, label: value }))} value={filters.estado} onChange={e => change('estado', e.target.value)} />
      <SelectField id={`${title}-prioridad`} label="Prioridad" help="Filtra por prioridad de recepción." placeholder="Todas" options={catalogos.data?.data.prioridades.map(p => ({ value: String(p.id), label: p.nombre })) ?? []} value={filters.idPrioridad} onChange={e => change('idPrioridad', e.target.value)} />
      <SelectField id={`${title}-tecnico`} label="Técnico" help="Filtra por el técnico de servicio." placeholder="Todos" options={catalogos.data?.data.tecnicos.map(t => ({ value: String(t.id), label: t.nombre })) ?? []} value={filters.idTecnico} onChange={e => change('idTecnico', e.target.value)} />
      {(['idCliente', 'idEquipo'] as const).map(key => <TextField key={key} id={`${title}-${key}`} label={key === 'idCliente' ? 'ID de cliente' : 'ID de equipo'} inputMode="numeric" value={filters[key]} onChange={e => { if (/^\d*$/.test(e.target.value)) change(key, e.target.value) }} />)}
      <TextField id={`${title}-desde`} label="Desde" type="date" value={filters.fechaDesde} onChange={e => change('fechaDesde', e.target.value)} />
      <TextField id={`${title}-hasta`} label="Hasta" type="date" value={filters.fechaHasta} error={!validDates ? 'Debe ser igual o posterior a Desde.' : undefined} onChange={e => change('fechaHasta', e.target.value)} />
      <SelectField id={`${title}-tamano`} label="Por página" allowEmpty={false} options={[5, 10, 20, 50].map(value => ({ value: String(value), label: String(value) }))} value={String(filters.pageSize)} onChange={e => setFilters({ ...filters, pageSize: Number(e.target.value), page: 1 })} />
    </div>
    {catalogos.isError && <ErrorState description={catalogos.error.message} onRetry={() => void catalogos.refetch()} />}
    {orders.isPending ? <LoadingState label="Consultando órdenes…" /> : orders.isError ? <ErrorState description={orders.error.message} onRetry={() => void orders.refetch()} /> : <>
      {!orders.data.data.length ? <EmptyState title="Sin órdenes" description="No hay órdenes que coincidan con estos filtros." /> : <Table containerLabel={title}><caption className="sr-only">{title}</caption><TableHeader><TableRow>{['Orden', 'Cliente', 'Equipo', 'Estado', 'Prioridad', 'Ingreso'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{orders.data.data.map(o => <TableRow key={o.idOrden}>
        <TableCell><Link className="rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" to={`/ordenes/${o.idOrden}`}>{o.numeroOrden}</Link></TableCell><TableCell>{o.clienteNombre}</TableCell><TableCell>{o.numeroSerie}</TableCell><TableCell><StatusBadge state={o.estado} /></TableCell><TableCell><PriorityBadge priority={o.prioridad} /></TableCell><TableCell>{formatUtcDateTime(o.fechaIngreso)}</TableCell>
      </TableRow>)}</TableBody></Table>}
      <div className="flex items-center gap-3"><Button variant="outline" disabled={filters.page <= 1 || orders.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</Button><span>Página {filters.page} de {Math.max(1, orders.data.meta?.totalPages ?? 1)} · {orders.data.meta?.total ?? orders.data.data.length} órdenes</span><Button variant="outline" disabled={filters.page >= (orders.data.meta?.totalPages ?? 1) || orders.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Siguiente</Button></div>
    </>}
  </section>
}

export function OrdenesPage(_props: { catalogos?: OrdenCatalogos }) {
  // Keep the previous optional props contract; production options always come from the API.
  void _props
  const [showForm, setShowForm] = useState(false)
  const { user } = useSession()
  const navigate = useNavigate()
  return <div className="space-y-5"><PageHeader eyebrow="TechCare / Recepción" title="Órdenes de servicio" description="Recepción y seguimiento de equipos." actions={canService(user, 'ORDENES_CREAR') && !showForm && <Button onClick={() => setShowForm(true)}>Nueva orden</Button>} />
    {showForm && <OrdenForm onCancel={() => setShowForm(false)} onCreated={id => navigate(`/ordenes/${id}`)} />}
    <OrdenList />
  </div>
}
