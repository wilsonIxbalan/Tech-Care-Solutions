import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AreaField, SelectField, TextField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import { createFacturacionSchema } from './facturacion-schema'
import type { OrdenFacturacion } from './facturacion-schema'

export function FacturacionForm({ ordenes, onCancel }: { ordenes?: readonly OrdenFacturacion[]; onCancel: () => void }) {
  const schema = createFacturacionSchema(ordenes)
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { idOrden: '', nitFacturacion: '', nombreFacturacion: '', direccionFacturacion: '' } })
  const [message, setMessage] = useState('')
  const { errors } = form.formState
  const disponibles = ordenes?.filter(o => o.estado === 'LISTO')
  return <form aria-label="Borrador de datos de facturación" noValidate className="space-y-5" onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Datos preliminares válidos. Todavía no se ha emitido ni guardado una factura; falta conectar la API.'), () => setMessage(''))}>
    <SelectField id="facturacion-orden" label="Orden" required options={disponibles?.map(o => ({ value: String(o.idOrden), label: o.numeroOrden }))} help="Sólo órdenes LISTO. El servidor comprobará que no exista factura previa, que no haya reparaciones abiertas y que existan conceptos facturables." error={errors.idOrden?.message} {...form.register('idOrden')} />
    <p className="text-sm text-muted-foreground">Estos datos son opcionales en el procedimiento SQL: vacíos heredan los datos del cliente. La API debe confirmar esta convención antes de emitir.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField id="facturacion-nit" label="NIT de facturación" maxLength={20} error={errors.nitFacturacion?.message} {...form.register('nitFacturacion')} />
      <TextField id="facturacion-nombre" label="Nombre de facturación" maxLength={150} error={errors.nombreFacturacion?.message} {...form.register('nombreFacturacion')} />
    </div><AreaField id="facturacion-direccion" label="Dirección de facturación" maxLength={250} error={errors.direccionFacturacion?.message} {...form.register('direccionFacturacion')} />
    <p className="text-sm text-muted-foreground">Número, responsable, fecha, líneas, tasa aplicable, impuesto y total serán confirmados por el servidor. La política de impuestos debe acordarse con backend.</p>
    <DraftActions blocked={!disponibles?.length} message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
