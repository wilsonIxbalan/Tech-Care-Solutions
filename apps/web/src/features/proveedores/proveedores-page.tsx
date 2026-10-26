import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DraftSection } from '@/components/shared/draft-section'
import { TextField, SelectField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import type { ReceivedData } from '@/lib/received-data'
import { ProveedorForm } from './proveedor-form'
import type { ProveedorRow } from './proveedor-schema'

export function ProveedoresPage({ proveedores = { status: 'pending' } }: { proveedores?: ReceivedData<ProveedorRow> }) {
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')
  const rows = proveedores.status === 'success' ? { ...proveedores, data: proveedores.data.filter(p => (!estado || p.estado === estado) && `${p.nit} ${p.nombre}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) } : proveedores
  return <><PageHeader title="Proveedores" description="Preparación de datos y consulta. Conexión con la API pendiente." />
    <DraftSection title="Datos del proveedor" action="Preparar proveedor">{cancel => <ProveedorForm onCancel={cancel} />}</DraftSection>
    <section aria-label="Listado de proveedores" className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
      <TextField id="proveedores-busqueda" label="Filtrar por NIT o nombre" value={search} onChange={e => setSearch(e.target.value)} />
      <SelectField id="proveedores-estado" label="Filtrar por estado" placeholder="Todos" options={['ACTIVO', 'INACTIVO'].map(value => ({ value, label: value }))} value={estado} onChange={e => setEstado(e.target.value)} />
    </div><p className="text-xs text-muted-foreground">Los filtros se aplican sólo a las filas recibidas.</p><ReceivedTable state={rows} caption="Proveedores" rowKey={p => p.idProveedor} columns={[
      { title: 'NIT', cell: p => p.nit }, { title: 'Nombre', cell: p => p.nombre }, { title: 'Contacto', cell: p => p.nombreContacto }, { title: 'Teléfono', cell: p => p.telefono }, { title: 'Correo', cell: p => p.email }, { title: 'Estado', cell: p => p.estado },
    ]} /></section></>
}
