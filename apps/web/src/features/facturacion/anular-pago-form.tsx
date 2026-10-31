import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AreaField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import type { PagoDto } from '@/types/domain'
import { anularPagoSchema } from './facturacion-schema'
import { anularPago, isUnconfirmed, useBillingWrite } from './api'
import { BillingConfirmation, BillingError } from './billing-feedback'

export function AnularPagoForm({ pago, idOrden, allowed, onCancel, onSaved }: {
  pago: PagoDto; idOrden: number; allowed: boolean; onCancel: () => void; onSaved: () => void
}) {
  const form = useForm({ resolver: zodResolver(anularPagoSchema), defaultValues: { motivo: '' } })
  const write = useBillingWrite((values: { motivo: string }) => anularPago(pago.idPago, values), idOrden)
  const [confirmation, setConfirmation] = useState<{ motivo: string } | null>(null)
  const locked = useRef(false)
  async function confirm() {
    if (!confirmation || !allowed || pago.estado !== 'APLICADO' || locked.current || isUnconfirmed(write.error)) return
    locked.current = true
    try {
      await write.mutateAsync(confirmation)
      toast.success('Pago anulado correctamente.')
      setConfirmation(null)
      onSaved()
    } catch { /* The reason is preserved on rejection or an unconfirmed response. */ }
    finally { locked.current = false }
  }
  return <section className="space-y-4 rounded-lg border p-4">
    <form aria-label="Anular pago" noValidate className="space-y-4" onSubmit={form.handleSubmit(values => { if (allowed && pago.estado === 'APLICADO' && !write.isPending && !isUnconfirmed(write.error)) setConfirmation(values) })}>
      <h3 className="font-semibold">Anular pago #{pago.idPago} · {formatMoney(pago.monto)}</h3>
      <AreaField id="pago-motivo" placeholder="Explica por qué se anula el pago" label="Motivo de anulación" required maxLength={300} disabled={write.isPending || confirmation !== null} error={form.formState.errors.motivo?.message} {...form.register('motivo')} />
      {!confirmation && <BillingError error={write.error} />}
      {!allowed && <p role="alert" className="text-sm">No se puede anular este pago. Comprueba el estado de la orden; una entrega impide la anulación.</p>}
      <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={write.isPending} onClick={onCancel}>Cancelar</Button><Button type="submit" variant="destructive" disabled={!allowed || pago.estado !== 'APLICADO' || write.isPending || confirmation !== null || isUnconfirmed(write.error)}>Revisar anulación</Button></div>
    </form>
    <BillingConfirmation open={confirmation !== null} title="Confirmar anulación de pago" description={`Se anulará el pago #${pago.idPago} de ${formatMoney(pago.monto)} y se actualizará el saldo de la factura. El historial conservará el motivo.`} confirmLabel="Anular pago" destructive canConfirm={allowed && pago.estado === 'APLICADO'} pending={write.isPending} error={write.error} onCancel={() => setConfirmation(null)} onConfirm={confirm}>
      <p className="break-words text-sm">Motivo: {confirmation?.motivo}</p>
    </BillingConfirmation>
  </section>
}
