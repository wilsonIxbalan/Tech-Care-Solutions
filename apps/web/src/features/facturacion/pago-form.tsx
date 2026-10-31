import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import type { FacturaResumenDto } from '@/types/domain'
import { formatMoney } from '@/lib/format'
import { admiteBorradorPago, createPagoSchema, type MetodoPagoOption } from './facturacion-schema'
import { isUnconfirmed, registrarPago, useBillingWrite } from './api'
import { BillingError } from './billing-feedback'

export function PagoForm({ facturas, metodos, onCancel, onSaved, enabled = true }: {
  facturas?: readonly FacturaResumenDto[]; metodos?: readonly MetodoPagoOption[]; onCancel: () => void; onSaved?: () => void; enabled?: boolean
}) {
  const schema = createPagoSchema(facturas, metodos)
  type Values = z.output<typeof schema>
  const factura = facturas?.length === 1 ? facturas[0] : undefined
  const form = useForm<z.input<typeof schema>, unknown, Values>({ resolver: zodResolver(schema), defaultValues: { idFactura: factura ? String(factura.idFactura) : '', idMetodoPago: '', monto: '', referencia: '' } })
  const write = useBillingWrite((values: Values) => registrarPago(Number(values.idFactura), { idMetodoPago: Number(values.idMetodoPago), monto: values.monto, referencia: values.referencia || null }), factura?.idOrden ?? null)
  const locked = useRef(false)
  const { errors } = form.formState
  const disponibles = facturas?.filter(admiteBorradorPago) ?? []
  const activos = metodos?.filter(m => m.activo) ?? []
  async function submit(values: Values) {
    if (!enabled || locked.current || write.isPending || isUnconfirmed(write.error)) return
    locked.current = true
    try {
      await write.mutateAsync(values)
      toast.success('Pago registrado correctamente.')
      form.reset()
      onSaved?.()
    } catch { /* Keep the entered amount and reference for review. */ }
    finally { locked.current = false }
  }
  return <form aria-label="Registrar pago" noValidate className="space-y-5 rounded-lg border p-4" onSubmit={event => { void form.handleSubmit(submit)(event) }}>
    <h3 className="font-semibold">Registrar pago</h3>
    <fieldset disabled={write.isPending} className="grid gap-4 sm:grid-cols-2">
      <SelectField id="pago-factura" label="Factura" required options={disponibles.map(f => ({ value: String(f.idFactura), label: `${f.numeroFactura} · ${formatMoney(f.saldo)}` }))} error={errors.idFactura?.message} help="Selecciona la factura que recibirá el pago." {...form.register('idFactura')} />
      <SelectField id="pago-metodo" label="Método de pago" required options={activos.map(m => ({ value: String(m.idMetodoPago), label: m.nombre }))} help={activos.length ? 'Solo métodos activos.' : 'No hay métodos de pago activos disponibles.'} error={errors.idMetodoPago?.message} {...form.register('idMetodoPago')} />
      <TextField id="pago-monto" placeholder="0.00" autoComplete="off" label="Monto" required inputMode="decimal" help="Mayor que cero y hasta dos decimales. Se admiten pagos parciales." error={errors.monto?.message} {...form.register('monto')} />
      <TextField id="pago-referencia" placeholder="Núm. de boleta, cheque o transacción" autoComplete="off" label="Referencia" maxLength={60} error={errors.referencia?.message} {...form.register('referencia')} />
    </fieldset>
    {factura && <p className="text-sm">Saldo: {formatMoney(factura.saldo)}</p>}
    <BillingError error={write.error} />
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={write.isPending} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={!enabled || write.isPending || !disponibles.length || !activos.length || isUnconfirmed(write.error)}>{write.isPending ? 'Registrando…' : 'Registrar pago'}</Button></div>
  </form>
}
