import { ReceivedTable } from '@/components/shared/received-table'
import type { FacturaDetalleDto } from '@/types/domain'

export function FacturaDetalle({ factura }: { factura: FacturaDetalleDto }) {
  return <div className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">{factura.numeroFactura} · {factura.estado}</h3>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {[
        ['Orden', factura.numeroOrden], ['Cliente', factura.clienteNombre], ['NIT de facturación', factura.nitFacturacion], ['Nombre de facturación', factura.nombreFacturacion], ['Dirección', factura.direccionFacturacion ?? '—'], ['Fecha (UTC)', factura.fechaFactura],
        ['Mano de obra (Q)', factura.subtotalManoObra], ['Repuestos (Q)', factura.subtotalRepuestos], ['Subtotal (Q)', factura.subtotal], ['Tasa (%)', factura.porcentajeImpuesto], ['Impuesto (Q)', factura.impuesto], ['Total (Q)', factura.total], ['Total pagado (Q)', factura.totalPagado], ['Saldo (Q)', factura.saldo],
      ].map(([label, value]) => <div key={label} className="min-w-0 break-words"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
    </dl><p className="text-xs text-muted-foreground">Importes recibidos del servidor. No se recalculan impuestos, saldo ni totales a partir de estas filas.</p>
    <ReceivedTable state={{ status: 'success', data: factura.detalles }} caption="Líneas de factura" rowKey={d => d.idDetalleFactura} columns={[
      { title: 'Tipo', cell: d => d.tipoLinea }, { title: 'Descripción', cell: d => d.descripcion }, { title: 'Cantidad', cell: d => d.cantidad }, { title: 'Precio histórico (Q)', cell: d => d.precioUnitario }, { title: 'Subtotal (Q)', cell: d => d.subtotal },
    ]} />
    <ReceivedTable state={{ status: 'success', data: factura.pagos }} caption="Pagos de la factura" rowKey={p => p.idPago} columns={[
      { title: 'Fecha (UTC)', cell: p => p.fechaPago }, { title: 'Método', cell: p => p.metodoPagoNombre }, { title: 'Monto (Q)', cell: p => p.monto }, { title: 'Referencia', cell: p => p.referencia }, { title: 'Estado', cell: p => p.estado }, { title: 'Responsable', cell: p => p.usuarioNombre }, { title: 'Motivo de anulación', cell: p => p.motivoAnulacion },
    ]} />
  </div>
}
