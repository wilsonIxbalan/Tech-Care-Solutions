import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ambiguousResult, confirmed, useSupplyAccess, useSupplyMutation } from '@/features/inventario/api'
import { SupplyError } from '@/features/inventario/supply-controls'
import type { CompraDetalleDto } from '@/types/domain'

export function RecibirCompra({ compra }: { compra: CompraDetalleDto }) {
  const { purchases } = useSupplyAccess()
  const [open, setOpen] = useState(false)
  const [received, setReceived] = useState(false)
  const sending = useRef(false)
  const receive = useSupplyMutation<Record<string, never>, { idCompra: number; estado: string }>(`/compras/${compra.idCompra}/recibir`, 'POST', 'Compra recibida. Inventario actualizado.', data => confirmed(data?.idCompra === compra.idCompra && data.estado === 'RECIBIDA'))
  const blocked = !purchases || compra.estado !== 'PENDIENTE' || received || receive.isPending || ambiguousResult(receive.error)
  async function confirm() {
    if (blocked || sending.current) return
    sending.current = true
    try { await receive.mutateAsync({}); setReceived(true); setOpen(false) }
    catch { /* Do not claim stock changed. Keep server error and never retry automatically. */ }
    finally { sending.current = false }
  }
  if (!purchases || compra.estado !== 'PENDIENTE') return null
  return <div className="space-y-3">
    <Button type="button" disabled={blocked} onClick={() => setOpen(true)}>{received ? 'Recepción confirmada' : 'Recibir compra'}</Button>
    <SupplyError error={receive.error} />
    <Dialog open={open} onOpenChange={value => { if (!receive.isPending) setOpen(value) }}><DialogContent>
      <DialogHeader><DialogTitle>Recibir {compra.numeroCompra}</DialogTitle><DialogDescription>La recepción completa aumentará las existencias de {compra.bodegaNombre}. Esta operación solo puede realizarse una vez.</DialogDescription></DialogHeader>
      <SupplyError error={receive.error} />
      <div className="flex gap-3"><Button disabled={blocked} onClick={() => void confirm()}>{receive.isPending ? 'Recibiendo…' : 'Confirmar recepción'}</Button><Button variant="outline" disabled={receive.isPending} onClick={() => setOpen(false)}>Volver</Button></div>
    </DialogContent></Dialog>
  </div>
}
