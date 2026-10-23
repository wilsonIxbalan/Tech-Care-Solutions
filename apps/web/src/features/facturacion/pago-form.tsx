import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import type { FacturaResumenDto } from '@/types/domain'
import { admiteBorradorPago, createPagoSchema } from './facturacion-schema'
import type { MetodoPagoOption } from './facturacion-schema'

export function PagoForm({ facturas, metodos, onCancel }: { facturas?: readonly FacturaResumenDto[]; metodos?: readonly MetodoPagoOption[]; onCancel: () => void }) {
  const schema = createPagoSchema(facturas, metodos)
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { idFactura: '', idMetodoPago: '', monto: '', referencia: '' } })
  const [message, setMessage] = useState('')
  const idFactura = useWatch({ control: form.control, name: 'idFactura' })
  const factura = facturas?.find(f => String(f.idFactura) === idFactura)
  const { errors } = form.formState
  const disponibles = facturas?.filter(admiteBorradorPago)
  const activos = metodos?.filter(m => m.activo)
  return <form aria-label="Borrador de pago" noValidate className="space-y-5" onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Borrador válido frente al saldo recibido. Todavía no se ha registrado ni cobrado ningún pago; falta conectar la API.'), () => setMessage(''))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField id="pago-factura" label="Factura" required options={disponibles?.map(f => ({ value: String(f.idFactura), label: `${f.numeroFactura} · saldo Q ${f.saldo}` }))} error={errors.idFactura?.message} {...form.register('idFactura', { onChange: () => form.resetField('monto') })} />
      <SelectField id="pago-metodo" label="Método de pago" required options={activos?.map(m => ({ value: String(m.idMetodoPago), label: m.nombre }))} error={errors.idMetodoPago?.message} {...form.register('idMetodoPago')} />
      <TextField id="pago-monto" label="Monto" required inputMode="decimal" help="Mayor que cero, punto decimal y hasta dos decimales." error={errors.monto?.message} {...form.register('monto')} />
      <TextField id="pago-referencia" label="Referencia" maxLength={60} error={errors.referencia?.message} {...form.register('referencia')} />
    </div>
    <p className="text-sm">Saldo recibido: {factura ? `Q ${factura.saldo}` : 'Selecciona una factura con saldo verificable.'}</p>
    <p className="text-sm text-muted-foreground">Se admiten varios pagos y pagos parciales. Esta comprobación es preliminar: el servidor deberá comprobar el saldo vigente y los permisos en la misma transacción. Responsable y fecha del pago corresponden al servidor.</p>
    <DraftActions blocked={!disponibles?.length || !activos?.length} message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
