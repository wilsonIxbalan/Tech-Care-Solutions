import { PageHeader } from '@/components/shared/page-header'
import { DraftSection } from '@/components/shared/draft-section'
import { ReceivedTable } from '@/components/shared/received-table'
import type { ReceivedData } from '@/lib/received-data'
import type { CompraDetalleDto, CompraResumenDto } from '@/types/domain'
import { CompraForm } from './compra-form'
import type { CompraCatalogos } from './compra-schema'

export function ComprasPage({ catalogos = {}, compras, detalle }: { catalogos?: CompraCatalogos; compras?: ReceivedData<CompraResumenDto>; detalle?: CompraDetalleDto }) {
  return <><PageHeader title="Compras" description="Encabezado y detalle del borrador. Registro y recepción pendientes de integración transaccional." />
    <DraftSection title="Preparación de compra" action="Preparar compra">{cancel => <CompraForm catalogos={catalogos} onCancel={cancel} />}</DraftSection>
    <ReceivedTable state={compras} caption="Compras" rowKey={c => c.idCompra} columns={[
      { title: 'Compra', cell: c => c.numeroCompra }, { title: 'Proveedor', cell: c => c.proveedorNombre }, { title: 'Bodega', cell: c => c.bodegaNombre },
      { title: 'Fecha (UTC)', cell: c => c.fechaCompra }, { title: 'Estado', cell: c => c.estado }, { title: 'Total del servidor (Q)', cell: c => c.total },
    ]} />
    <section className="space-y-3" aria-label="Detalle de compra"><h2 className="text-lg font-semibold">Detalle de compra</h2>
      {detalle ? <><p>{detalle.numeroCompra} · {detalle.estado} · Total del servidor: Q {detalle.total}</p><ReceivedTable state={{ status: 'success', data: detalle.items }} caption="Líneas de compra" rowKey={i => i.idDetalleCompra} columns={[
        { title: 'Código', cell: i => i.codigoRepuesto }, { title: 'Repuesto', cell: i => i.repuestoNombre }, { title: 'Cantidad', cell: i => i.cantidad }, { title: 'Costo histórico (Q)', cell: i => i.costoUnitario }, { title: 'Subtotal del servidor (Q)', cell: i => i.subtotal },
      ]} /></> : <p className="text-sm text-muted-foreground">El detalle debe recibirse de la API. Todavía no se ha consultado una compra.</p>}
      <p className="text-sm text-muted-foreground">Recepción pendiente de integración: sólo una compra PENDIENTE puede recibirse. El servidor volverá a comprobar permisos, bodega y repuestos activos; aplicará todos los movimientos en una transacción.</p>
    </section></>
}
