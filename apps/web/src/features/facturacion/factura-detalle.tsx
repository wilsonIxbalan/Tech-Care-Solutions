import { ReceivedTable } from '@/components/shared/received-table'
import type { FacturaDetalleDto } from '@/types/domain'
import { formatMoney, formatUtcDateTime } from '@/lib/format'

export function FacturaDetalle({ factura }: { factura: FacturaDetalleDto }) {
  return <div className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">{factura.numeroFactura} · {factura.estado}</h3>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {[
        ['Orden', factura.numeroOrden], ['Cliente', factura.clienteNombre], ['NIT de facturación', factura.nitFacturacion], ['Nombre de facturación', factura.nombreFacturacion], ['Dirección', factura.direccionFacturacion ?? '—'], ['Fecha (UTC)', formatUtcDateTime(factura.fechaFactura)],
        ['Mano de obra (Q)', formatMoney(factura.subtotalManoObra)], ['Repuestos (Q)', formatMoney(factura.subtotalRepuestos)], ['Subtotal (Q)', formatMoney(factura.subtotal)], ['Tasa (%)', factura.porcentajeImpuesto], ['Impuesto (Q)', formatMoney(factura.impuesto)], ['Total (Q)', formatMoney(factura.total)], ['Total pagado (Q)', formatMoney(factura.totalPagado)], ['Saldo (Q)', formatMoney(factura.saldo)],
      ].map(([label, value]) => <div key={label} className="min-w-0 break-words"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
    </dl><p className="text-xs text-muted-foreground">Importes recibidos del servidor. No se recalculan impuestos, saldo ni totales a partir de estas filas.</p>
    <ReceivedTable state={{ status: 'success', data: factura.detalles }} caption="Líneas de factura" rowKey={d => d.idDetalleFactura} columns={[
      { title: 'Tipo', cell: d => d.tipoLinea }, { title: 'Origen recibido', cell: d => d.idReparacion !== null ? `Reparación #${d.idReparacion}` : d.idRepuestoReparacion !== null ? `Consumo #${d.idRepuestoReparacion}` : 'Origen no recibido' },
      { title: 'Descripción', cell: d => d.descripcion }, { title: 'Cantidad', cell: d => d.cantidad }, { title: 'Precio histórico (Q)', cell: d => formatMoney(d.precioUnitario) }, { title: 'Subtotal (Q)', cell: d => formatMoney(d.subtotal) },
    ]} />
    <ReceivedTable state={{ status: 'success', data: factura.pagos }} caption="Pagos de la factura" rowKey={p => p.idPago} columns={[
      { title: 'Fecha (UTC)', cell: p => formatUtcDateTime(p.fechaPago) }, { title: 'Método', cell: p => p.metodoPagoNombre }, { title: 'Monto (Q)', cell: p => formatMoney(p.monto) }, { title: 'Referencia', cell: p => p.referencia }, { title: 'Estado', cell: p => p.estado }, { title: 'Responsable', cell: p => p.usuarioNombre }, { title: 'Motivo de anulación', cell: p => p.motivoAnulacion },
    ]} />
  </div>
}
