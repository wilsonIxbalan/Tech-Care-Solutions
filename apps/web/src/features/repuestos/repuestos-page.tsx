import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DraftSection } from '@/components/shared/draft-section'
import { TextField, SelectField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import type { ReceivedData } from '@/lib/received-data'
import { formatMoney } from '@/lib/format'
import { RepuestoForm } from './repuesto-form'
import type { CategoriaOption, RepuestoRow } from './repuesto-model'

export function RepuestosPage({ categorias, repuestos = { status: 'pending' } }: { categorias?: readonly CategoriaOption[]; repuestos?: ReceivedData<RepuestoRow> }) {
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState('')
  const rows = repuestos.status === 'success' ? { ...repuestos, data: repuestos.data.filter(r => (!categoria || String(r.idCategoria) === categoria) && (!estado || r.estado === estado) && `${r.codigo} ${r.nombre}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) } : repuestos
  return <><PageHeader title="Repuestos" description="Catálogo de repuestos y precios de referencia. Conexión y guardado pendientes." />
    <DraftSection title="Datos del repuesto" action="Preparar repuesto">{cancel => <RepuestoForm categorias={categorias} onCancel={cancel} />}</DraftSection>
    <section className="space-y-4" aria-label="Listado de repuestos"><div className="grid gap-4 sm:grid-cols-3">
      <TextField id="repuestos-busqueda" label="Filtrar por código o nombre" value={search} onChange={e => setSearch(e.target.value)} />
      <SelectField id="repuestos-categoria" label="Filtrar por categoría" placeholder="Todas" options={categorias?.map(c => ({ value: String(c.idCategoria), label: c.nombre }))} value={categoria} onChange={e => setCategoria(e.target.value)} />
      <SelectField id="repuestos-estado" label="Filtrar por estado" placeholder="Todos" options={['ACTIVO', 'INACTIVO'].map(value => ({ value, label: value }))} value={estado} onChange={e => setEstado(e.target.value)} />
    </div><p className="text-xs text-muted-foreground">Los filtros se aplican sólo a las filas recibidas. No se ha solicitado un catálogo al servidor.</p>
      <ReceivedTable state={rows} caption="Repuestos" rowKey={r => r.idRepuesto} columns={[
        { title: 'Código', cell: r => r.codigo }, { title: 'Nombre', cell: r => r.nombre }, { title: 'Categoría', cell: r => categorias?.find(c => c.idCategoria === r.idCategoria)?.nombre },
        { title: 'Compra ref. (Q)', cell: r => formatMoney(r.precioCompraReferencia) }, { title: 'Venta (Q)', cell: r => formatMoney(r.precioVenta) }, { title: 'Estado', cell: r => r.estado },
      ]} />
    </section></>
}
