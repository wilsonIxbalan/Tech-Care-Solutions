import { ReceivedTable } from '@/components/shared/received-table'
import { formatMoney, formatGuatemalaDateTime } from '@/lib/format'
import type { CompraDetalleDto } from '@/types/domain'

export function CompraDetalle({ compra }: { compra: CompraDetalleDto }) {
  const fields = [
    ['Compra', compra.numeroCompra], ['Estado', compra.estado], ['Proveedor', compra.proveedorNombre],
    ['Bodega destino', compra.bodegaNombre], ['Documento del proveedor', compra.numeroDocumentoProveedor ?? '—'],
    ['Registro (Guatemala)', formatGuatemalaDateTime(compra.fechaCompra)], ['Responsable de registro (ID recibido)', String(compra.idUsuarioRegistro)],
    ['Recepción (Guatemala)', formatGuatemalaDateTime(compra.fechaRecepcion)], ['Responsable de recepción (ID recibido)', compra.idUsuarioRecepcion === null ? '—' : String(compra.idUsuarioRecepcion)],
    ['Observaciones', compra.observaciones ?? '—'], ['Total del servidor', formatMoney(compra.total)],
  ]
  return <div className="space-y-4 rounded-xl border p-4">
    <dl className="grid gap-3 text-sm sm:grid-cols-2">{fields.map(([label, value]) => <div className="min-w-0 break-words" key={label}><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}</dl>
    <ReceivedTable state={{ status: 'success', data: compra.items }} caption="Líneas de compra" rowKey={i => i.idDetalleCompra} columns={[
      { title: 'Código', cell: i => i.codigoRepuesto }, { title: 'Repuesto', cell: i => i.repuestoNombre }, { title: 'Cantidad', cell: i => i.cantidad },
      { title: 'Costo histórico (Q)', cell: i => formatMoney(i.costoUnitario) }, { title: 'Subtotal del servidor (Q)', cell: i => formatMoney(i.subtotal) },
    ]} />
    <p className="text-xs text-muted-foreground">Detalle histórico recibido. No se recalculan sus costos, subtotales ni total a partir del catálogo actual.</p>
  </div>
}
