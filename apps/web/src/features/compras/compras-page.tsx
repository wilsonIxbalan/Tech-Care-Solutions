import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DraftSection } from '@/components/shared/draft-section'
import { SelectField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { formatMoney, formatUtcDateTime } from '@/lib/format'
import type { ReceivedData } from '@/lib/received-data'
import type { CompraDetalleDto, CompraResumenDto } from '@/types/domain'
import { CompraForm } from './compra-form'
import { CompraDetalle } from './compra-detalle'
import type { CompraCatalogos } from './compra-schema'

export function ComprasPage({ catalogos = {}, compras, detalle, detalles }: { catalogos?: CompraCatalogos; compras?: ReceivedData<CompraResumenDto>; detalle?: CompraDetalleDto; detalles?: ReceivedData<CompraDetalleDto> }) {
  const [idCompra, setIdCompra] = useState(detalle ? String(detalle.idCompra) : '')
  const [estado, setEstado] = useState('')
  const receivedDetails = detalles === undefined ? detalle ? [detalle] : undefined : detalles.status === 'success' ? detalles.data : undefined
  const options = compras?.status === 'success' ? compras.data : receivedDetails
  const selected = receivedDetails?.find(c => String(c.idCompra) === idCompra)
  const filtered = compras?.status === 'success' ? { ...compras, data: compras.data.filter(c => !estado || c.estado === estado) } : compras
  return <><PageHeader title="Compras" description="Encabezado y detalle del borrador. Registro y recepción pendientes de integración transaccional." />
    <DraftSection title="Preparación de compra" action="Preparar compra">{cancel => <CompraForm catalogos={catalogos} onCancel={cancel} />}</DraftSection>
    <SelectField id="compras-estado" label="Filtrar compras recibidas por estado" placeholder="Todos" options={['PENDIENTE', 'RECIBIDA', 'ANULADA'].map(value => ({ value, label: value }))} value={estado} onChange={e => setEstado(e.target.value)} />
    <ReceivedTable state={filtered} caption="Compras" rowKey={c => c.idCompra} columns={[
      { title: 'Compra', cell: c => c.numeroCompra }, { title: 'Proveedor', cell: c => c.proveedorNombre }, { title: 'Bodega', cell: c => c.bodegaNombre },
      { title: 'Fecha (UTC)', cell: c => formatUtcDateTime(c.fechaCompra) }, { title: 'Estado', cell: c => c.estado }, { title: 'Total del servidor (Q)', cell: c => formatMoney(c.total) },
    ]} />
    <section className="space-y-3" aria-label="Detalle de compra"><h2 className="text-lg font-semibold">Detalle de compra</h2>
      <SelectField id="compra-detalle" label="Ver detalle de compra recibido" options={options?.map(c => ({ value: String(c.idCompra), label: c.numeroCompra }))} value={idCompra} onChange={e => setIdCompra(e.target.value)} />
      {!idCompra ? <p className="text-sm text-muted-foreground">Selecciona una compra del conjunto recibido. Esta selección no solicita datos al servidor.</p>
        : detalles?.status === 'loading' ? <LoadingState label="Cargando detalles de compra…" />
        : detalles?.status === 'error' ? <ErrorState description={detalles.message} />
        : selected ? <CompraDetalle compra={selected} />
        : receivedDetails ? <EmptyState title="Detalle no incluido en los datos recibidos" description="El conjunto recibido no incluye el detalle de esta compra. No se ha solicitado otra consulta." />
        : <EmptyState title="Detalle de compra pendiente de conexión" description="Todavía no se ha recibido el detalle de la compra seleccionada." />}
      <p className="text-sm text-muted-foreground">Recepción pendiente de integración: sólo una compra PENDIENTE puede recibirse. El servidor volverá a comprobar permisos, bodega y repuestos activos; aplicará todos los movimientos en una transacción.</p>
    </section></>
}
