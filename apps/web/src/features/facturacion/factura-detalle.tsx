import { ReceivedTable } from '@/components/shared/received-table'
import type { FacturaDetalleDto } from '@/types/domain'
import { formatMoney, formatGuatemalaDateTime } from '@/lib/format'
import { useContext, useEffect, useId, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Tooltip } from 'radix-ui'
import { SessionContext } from '@/features/auth/session-context'
import { Button } from '@/components/ui/button'
import { downloadFile, downloadErrorMessage } from '@/lib/download-client'

function FacturaPdf({ factura }: { factura: FacturaDetalleDto }) {
  const controller = useRef<AbortController | null>(null)
  const descriptionId = useId()
  useEffect(() => () => { controller.current?.abort() }, [])
  const download = useMutation({ retry: false, mutationFn: async () => {
    controller.current = new AbortController()
    await downloadFile(`/facturas/${factura.idFactura}/pdf`, { type: 'pdf', filename: `${factura.numeroFactura}.pdf`, signal: controller.current.signal })
  } })
  const hint = 'Descarga la factura emitida con sus datos de facturación y pagos. Documento simulado sin validez fiscal.'
  return <div className="space-y-2"><Tooltip.Provider><Tooltip.Root><Tooltip.Trigger asChild>
    <Button variant="outline" aria-describedby={descriptionId} disabled={download.isPending} onClick={() => download.mutate()}>Descargar PDF</Button>
  </Tooltip.Trigger><Tooltip.Portal><Tooltip.Content sideOffset={5} className="z-50 max-w-sm rounded-md bg-foreground p-3 text-xs text-background">{hint}<Tooltip.Arrow /></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>
    <p id={descriptionId} className="text-xs text-muted-foreground">{hint}</p>
    {download.isPending && <p role="status">Descargando PDF…</p>}
    {download.isError && <p role="alert" className="text-sm text-destructive">{downloadErrorMessage(download.error)}</p>}
  </div>
}

export function FacturaDetalle({ factura }: { factura: FacturaDetalleDto }) {
  const session = useContext(SessionContext)
  const user = session?.user
  const canDownload = user?.roles.some(role => role === 'ADMINISTRADOR' || role === 'CAJA')
    && user.permisos.some(permission => ['FACTURAR', 'PAGOS_REGISTRAR', 'REPORTES_VER'].includes(permission))
  return <div className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">{factura.numeroFactura} · {factura.estado}</h3>
    {canDownload && user && <FacturaPdf key={`${user.idUsuario}-${factura.idFactura}`} factura={factura} />}
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {[
        ['Orden', factura.numeroOrden], ['Cliente', factura.clienteNombre], ['NIT de facturación', factura.nitFacturacion], ['Nombre de facturación', factura.nombreFacturacion], ['Dirección', factura.direccionFacturacion ?? '—'], ['Fecha (Guatemala)', formatGuatemalaDateTime(factura.fechaFactura)],
        ['Mano de obra (Q)', formatMoney(factura.subtotalManoObra)], ['Repuestos (Q)', formatMoney(factura.subtotalRepuestos)], ['Subtotal (Q)', formatMoney(factura.subtotal)], ['Tasa (%)', factura.porcentajeImpuesto], ['Impuesto (Q)', formatMoney(factura.impuesto)], ['Total (Q)', formatMoney(factura.total)], ['Total pagado (Q)', formatMoney(factura.totalPagado)], ['Saldo (Q)', formatMoney(factura.saldo)],
      ].map(([label, value]) => <div key={label} className="min-w-0 break-words"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <ReceivedTable state={{ status: 'success', data: factura.detalles }} caption="Líneas de factura" rowKey={d => d.idDetalleFactura} columns={[
      { title: 'Tipo', cell: d => d.tipoLinea }, { title: 'Origen', cell: d => d.idReparacion !== null ? `Reparación #${d.idReparacion}` : d.idRepuestoReparacion !== null ? `Consumo #${d.idRepuestoReparacion}` : 'Sin referencia' },
      { title: 'Descripción', cell: d => d.descripcion }, { title: 'Cantidad', cell: d => d.cantidad }, { title: 'Precio histórico (Q)', cell: d => formatMoney(d.precioUnitario) }, { title: 'Subtotal (Q)', cell: d => formatMoney(d.subtotal) },
    ]} />
    <ReceivedTable state={{ status: 'success', data: factura.pagos }} caption="Pagos de la factura" rowKey={p => p.idPago} columns={[
      { title: 'Fecha (Guatemala)', cell: p => formatGuatemalaDateTime(p.fechaPago) }, { title: 'Método', cell: p => p.metodoPagoNombre }, { title: 'Monto (Q)', cell: p => formatMoney(p.monto) }, { title: 'Referencia', cell: p => p.referencia }, { title: 'Estado', cell: p => p.estado }, { title: 'Responsable', cell: p => p.usuarioNombre }, { title: 'Motivo de anulación', cell: p => p.motivoAnulacion },
    ]} />
  </div>
}
