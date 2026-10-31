import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AreaField, TextField } from '@/components/shared/form-fields'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { createFacturacionSchema, porcentajeImpuestoSchema, type OrdenFacturacion } from './facturacion-schema'
import { generarFactura, isUnconfirmed, useBillingWrite, useOrdenFacturacion, useResumenFacturacion } from './api'
import { BillingConfirmation, BillingError } from './billing-feedback'
import { OrdenSelector } from './orden-selector'

export function FacturacionForm({ onCancel, onSaved, onViewFactura }: {
  onCancel: () => void; onSaved: (idFactura: number) => void; onViewFactura?: (idFactura: number) => void
}) {
  const [selected, setSelected] = useState<OrdenFacturacion | null>(null)
  const schema = createFacturacionSchema(selected ? [selected] : [])
  type Values = z.output<typeof schema>
  const form = useForm<z.input<typeof schema>, unknown, Values>({ resolver: zodResolver(schema), defaultValues: { idOrden: '', nitFacturacion: '', nombreFacturacion: '', direccionFacturacion: '', porcentajeImpuesto: '12.00' } })
  const rate = porcentajeImpuestoSchema.safeParse(useWatch({ control: form.control, name: 'porcentajeImpuesto' }))
  const orden = useOrdenFacturacion(selected?.idOrden ?? null, 'FACTURAR')
  const eligible = orden.isSuccess && orden.data.estado === 'LISTO' && !orden.data.factura && !orden.data.entrega
  const preview = useResumenFacturacion(selected?.idOrden ?? null, rate.success ? rate.data : null, eligible)
  const write = useBillingWrite((values: Values) => {
    const { idOrden, ...body } = values
    return generarFactura(Number(idOrden), body)
  }, selected?.idOrden ?? null)
  const [confirmation, setConfirmation] = useState<Values | null>(null)
  const locked = useRef(false)
  const ready = eligible && !orden.isFetching && preview.isSuccess && !preview.isFetching && rate.success && preview.data.porcentajeImpuesto === rate.data
  const disabled = write.isPending || confirmation !== null
  const { errors } = form.formState

  async function confirm() {
    if (!confirmation || !ready || locked.current || isUnconfirmed(write.error)) return
    locked.current = true
    try {
      const result = await write.mutateAsync(confirmation)
      toast.success(`Factura ${result.numeroFactura} generada.`)
      setConfirmation(null)
      onSaved(result.idFactura)
    } catch { /* The mutation error is displayed without losing the form. */ }
    finally { locked.current = false }
  }

  return <section aria-label="Nueva factura" className="space-y-5 rounded-xl border bg-card p-5">
    <h2 className="text-lg font-semibold">Generar factura desde orden</h2>
    <form aria-label="Datos de facturación" noValidate className="space-y-5" onSubmit={form.handleSubmit(values => { if (ready && !write.isPending && !isUnconfirmed(write.error)) setConfirmation(values) })}>
      <OrdenSelector selected={selected} disabled={disabled} error={errors.idOrden?.message} onSelect={value => { setSelected(value); form.setValue('idOrden', value ? String(value.idOrden) : '', { shouldValidate: true }) }} />
      {selected && (orden.isPending ? <LoadingState label="Consultando la orden seleccionada…" /> : orden.isError ? <ErrorState description={orden.error.message} onRetry={() => void orden.refetch()} /> : !eligible && <div role="alert" className="space-y-2 text-sm"><p>{orden.data.factura ? 'Esta orden ya tiene una factura.' : 'La orden debe estar LISTO y sin entrega para facturar.'}</p>{orden.data.factura && onViewFactura && <Button type="button" variant="outline" onClick={() => onViewFactura(orden.data.factura!.idFactura)}>Ver factura existente</Button>}</div>)}
      <p className="text-sm text-muted-foreground">Los datos fiscales vacíos se heredan del cliente. Comprueba los datos antes de confirmar.</p>
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <TextField id="facturacion-nit" placeholder="1234567-9 o CF" autoComplete="off" label="NIT de facturación" maxLength={20} error={errors.nitFacturacion?.message} {...form.register('nitFacturacion')} />
        <TextField id="facturacion-nombre" placeholder="Vacío: se usa el nombre del cliente" autoComplete="off" label="Nombre de facturación" maxLength={150} error={errors.nombreFacturacion?.message} {...form.register('nombreFacturacion')} />
        <div className="sm:col-span-2"><AreaField id="facturacion-direccion" placeholder="Vacío: se usa la dirección del cliente" label="Dirección de facturación" maxLength={250} error={errors.direccionFacturacion?.message} {...form.register('direccionFacturacion')} /></div>
        <TextField id="facturacion-impuesto" placeholder="12.00" autoComplete="off" label="Impuesto (%)" required inputMode="decimal" maxLength={6} help="Entre 0 y 100, hasta dos decimales." error={errors.porcentajeImpuesto?.message || (!rate.success ? rate.error.issues[0]?.message : undefined)} {...form.register('porcentajeImpuesto')} />
      </fieldset>
      {eligible && rate.success && (preview.isPending || preview.isFetching ? <LoadingState label="Consultando resumen de facturación…" /> : preview.isError ? <ErrorState description={preview.error.message} onRetry={() => void preview.refetch()} /> : preview.data && <div role="region" aria-label="Resumen de facturación" className="rounded-lg bg-muted/40 p-4"><h3 className="mb-3 font-medium">Resumen de facturación</h3><dl className="grid gap-3 text-sm sm:grid-cols-2">{[
        ['Mano de obra', formatMoney(preview.data.subtotalManoObra)], ['Repuestos', formatMoney(preview.data.subtotalRepuestos)], ['Impuesto', `${preview.data.porcentajeImpuesto}% · ${formatMoney(preview.data.impuesto)}`], ['Total', formatMoney(preview.data.total)],
      ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl></div>)}
      {!confirmation && <BillingError error={write.error} />}
      {isUnconfirmed(write.error) && <p className="text-sm">Cierra este formulario y consulta las facturas antes de intentar una nueva emisión.</p>}
      <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={write.isPending} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={!ready || disabled || isUnconfirmed(write.error)}>Revisar y generar</Button></div>
    </form>
    <BillingConfirmation open={confirmation !== null} title="Confirmar generación de factura" description={`Se emitirá una factura para ${selected?.numeroOrden ?? 'la orden seleccionada'} con los importes del resumen. La emisión no se puede deshacer desde esta pantalla.`} confirmLabel="Generar factura" canConfirm={ready} pending={write.isPending} error={write.error} onCancel={() => setConfirmation(null)} onConfirm={confirm}>
      {preview.data && <p className="font-semibold">Total: {formatMoney(preview.data.total)}</p>}
      {confirmation && <dl className="space-y-1 text-sm"><div><dt>NIT</dt><dd>{confirmation.nitFacturacion ?? 'Heredado del cliente'}</dd></div><div><dt>Nombre</dt><dd>{confirmation.nombreFacturacion ?? 'Heredado del cliente'}</dd></div><div><dt>Dirección</dt><dd>{confirmation.direccionFacturacion ?? 'Heredada del cliente'}</dd></div></dl>}
    </BillingConfirmation>
  </section>
}
