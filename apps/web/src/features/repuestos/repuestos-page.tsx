import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { TextField, SelectField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import type { ReceivedData } from '@/lib/received-data'
import { formatMoney } from '@/lib/format'
import { listState, useSupplyAccess, useSupplyCatalogs, useSupplyList } from '@/features/inventario/api'
import { SupplyPagination } from '@/features/inventario/supply-controls'
import { RepuestoForm } from './repuesto-form'
import type { CategoriaOption, RepuestoRow } from './repuesto-model'

export function RepuestosPage({ categorias: suppliedCategories, repuestos }: { categorias?: readonly CategoriaOption[]; repuestos?: ReceivedData<RepuestoRow> }) {
  const access = useSupplyAccess()
  const catalog = useSupplyCatalogs(access.stockRead && suppliedCategories === undefined)
  const categorias = suppliedCategories ?? catalog.data?.categorias
  const [filters, setFilters] = useState({ search: '', idCategoria: '', estado: '', page: 1, pageSize: 20 })
  const query = useSupplyList<RepuestoRow>('repuestos', filters, repuestos === undefined)
  const [editor, setEditor] = useState<RepuestoRow | 'new' | null>(null)
  if (!access.stockRead) return <EmptyState title="Acceso restringido" description="No tienes permiso para consultar repuestos." />
  return <><PageHeader title="Repuestos" description="Catálogo y precios. Las existencias se gestionan mediante compras y ajustes." actions={access.partsWrite && <Button disabled={Boolean(editor) || !categorias?.length} onClick={() => setEditor('new')}>Nuevo repuesto</Button>} />
    {!suppliedCategories && (catalog.isPending ? <LoadingState label="Consultando categorías…" /> : catalog.isError ? <ErrorState description={catalog.error.message} onRetry={() => void catalog.refetch()} /> : null)}
    {editor && access.partsWrite && <RepuestoForm key={editor === 'new' ? 'new' : editor.idRepuesto} categorias={categorias} repuesto={editor === 'new' ? undefined : editor} onCancel={() => setEditor(null)} onSaved={() => setEditor(null)} />}
    <section className="space-y-4" aria-label="Listado de repuestos"><div className="grid gap-4 sm:grid-cols-4">
      <TextField id="repuestos-busqueda" label="Buscar por código o nombre" type="search" maxLength={150} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
      <SelectField id="repuestos-categoria" label="Filtrar por categoría" placeholder="Todas" options={categorias?.map(c => ({ value: String(c.idCategoria), label: c.nombre })) ?? []} value={filters.idCategoria} onChange={e => setFilters({ ...filters, idCategoria: e.target.value, page: 1 })} />
      <SelectField id="repuestos-estado" label="Filtrar por estado" placeholder="Todos" options={['ACTIVO', 'INACTIVO'].map(value => ({ value, label: value }))} value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value, page: 1 })} />
      <SelectField id="repuestos-page-size" label="Por página" options={[10, 20, 50].map(value => ({ value: String(value), label: String(value) }))} value={String(filters.pageSize)} onChange={e => setFilters({ ...filters, pageSize: Number(e.target.value), page: 1 })} />
    </div><ReceivedTable state={listState(query, repuestos)} caption="Repuestos" rowKey={r => r.idRepuesto} columns={[
      { title: 'Código', cell: r => r.codigo }, { title: 'Nombre', cell: r => r.nombre }, { title: 'Categoría', cell: r => categorias?.find(c => c.idCategoria === r.idCategoria)?.nombre },
      { title: 'Compra ref. (Q)', cell: r => formatMoney(r.precioCompraReferencia) }, { title: 'Venta (Q)', cell: r => formatMoney(r.precioVenta) }, { title: 'Estado', cell: r => r.estado },
      { title: 'Acciones', cell: r => access.partsWrite ? <Button variant="outline" disabled={Boolean(editor) || !categorias?.length} aria-label={`Editar ${r.nombre}`} onClick={() => setEditor(r)}>Editar</Button> : 'Solo consulta' },
    ]} />
      {query.isError && <Button variant="outline" onClick={() => void query.refetch()}>Reintentar consulta</Button>}
      {!repuestos && <SupplyPagination meta={query.data?.meta} page={filters.page} busy={query.isFetching} onPage={page => setFilters({ ...filters, page })} label="repuestos" />}
    </section></>
}
