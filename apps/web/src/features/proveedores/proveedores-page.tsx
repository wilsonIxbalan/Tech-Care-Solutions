import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import { TextField, SelectField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import type { ReceivedData } from '@/lib/received-data'
import { listState, useSupplyAccess, useSupplyList } from '@/features/inventario/api'
import { SupplyPagination } from '@/features/inventario/supply-controls'
import { ProveedorForm } from './proveedor-form'
import type { ProveedorRow } from './proveedor-schema'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { PermissionNotice } from '@/components/shared/permission-notice'

export function ProveedoresPage({ proveedores }: { proveedores?: ReceivedData<ProveedorRow> }) {
  const access = useSupplyAccess()
  const [filters, setFilters] = useState({ search: '', estado: '', page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const search = useDebouncedValue(filters.search)
  const query = useSupplyList<ProveedorRow>('proveedores', { ...filters, search }, proveedores === undefined)
  const [editor, setEditor] = useState<ProveedorRow | 'new' | null>(null)
  if (!access.supplierRead) return <EmptyState title="Acceso restringido" description="No tienes permiso para consultar proveedores." />
  return <><PageHeader title="Proveedores" description="Contacto y datos de abastecimiento." actions={access.supplierWrite && <Button disabled={Boolean(editor)} onClick={() => setEditor('new')}>Nuevo proveedor</Button>} />
    <PermissionNotice permission="PROVEEDORES_GESTIONAR" action="registrar o editar proveedores" />
    {editor && access.supplierWrite && <ProveedorForm key={editor === 'new' ? 'new' : editor.idProveedor} proveedor={editor === 'new' ? undefined : editor} onCancel={() => setEditor(null)} onSaved={() => setEditor(null)} />}
    <section aria-label="Listado de proveedores" className="space-y-4"><div className="grid gap-4 sm:grid-cols-3">
      <TextField id="proveedores-busqueda" label="Buscar por NIT o nombre" type="search" placeholder="Buscar por NIT o nombre del proveedor…" maxLength={150} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
      <SelectField id="proveedores-estado" label="Filtrar por estado" placeholder="Todos" options={['ACTIVO', 'INACTIVO'].map(value => ({ value, label: value }))} value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value, page: 1 })} />
      <SelectField id="proveedores-page-size" label="Por página" allowEmpty={false} options={[5, 10, 20, 50].map(value => ({ value: String(value), label: String(value) }))} value={String(filters.pageSize)} onChange={e => setFilters({ ...filters, pageSize: Number(e.target.value), page: 1 })} />
    </div><ReceivedTable state={listState(query, proveedores)} caption="Proveedores" rowKey={p => p.idProveedor} columns={[
      { title: 'NIT', cell: p => p.nit }, { title: 'Nombre', cell: p => p.nombre }, { title: 'Contacto', cell: p => p.nombreContacto }, { title: 'Teléfono', cell: p => p.telefono }, { title: 'Correo', cell: p => p.email }, { title: 'Estado', cell: p => p.estado },
      { title: 'Acciones', cell: p => access.supplierWrite ? <Button variant="outline" disabled={Boolean(editor)} aria-label={`Editar ${p.nombre}`} onClick={() => setEditor(p)}>Editar</Button> : 'Solo consulta' },
    ]} />
      {query.isError && <Button variant="outline" onClick={() => void query.refetch()}>Reintentar consulta</Button>}
      {!proveedores && <SupplyPagination meta={query.data?.meta} page={filters.page} busy={query.isFetching} onPage={page => setFilters({ ...filters, page })} label="proveedores" />}
    </section></>
}
