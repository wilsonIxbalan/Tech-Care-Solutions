import { useDraftMessage } from '@/lib/use-draft-message'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SelectField, TextField, AreaField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import { createEntregaSchema, entregaRequirements, permiteBorradorEntrega } from './entrega-schema'
import type { OrdenEntrega } from './entrega-schema'

export function EntregaForm({ ordenes, onCancel }: { ordenes?: readonly OrdenEntrega[]; onCancel: () => void }) {
  const schema = createEntregaSchema(ordenes)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { idOrden: '', nombreRecibe: '', documentoRecibe: '', observaciones: '' } })
  const [message, setMessage] = useDraftMessage(ordenes)
  const idOrden = useWatch({ control: form.control, name: 'idOrden' })
  const orden = ordenes?.find(o => String(o.idOrden) === idOrden)
  const { errors } = form.formState
  return <form aria-label="Borrador de entrega" noValidate className="space-y-5" onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Borrador válido con los datos recibidos. Todavía no se ha registrado una entrega ni cerrado la orden; falta conectar la API.'), () => setMessage(''))}>
    <SelectField id="entrega-orden" label="Orden" required options={ordenes?.map(o => ({ value: String(o.idOrden), label: `${o.numeroOrden} · ${o.estado}` }))} help="Puedes revisar los requisitos recibidos de cada orden. Sólo se valida el borrador con estado LISTO, factura vigente y saldo cero verificables." error={errors.idOrden?.message} {...form.register('idOrden')} />
    <dl className="space-y-2 rounded-lg border p-3 text-sm" aria-label="Requisitos de entrega">{entregaRequirements(orden).map(item => <div key={item.label}><dt className="font-medium">{item.label}</dt><dd>{item.status}</dd></div>)}</dl>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField id="entrega-receptor" label="Nombre de quien recibe" required maxLength={150} error={errors.nombreRecibe?.message} {...form.register('nombreRecibe')} />
      <TextField id="entrega-documento" label="Documento de quien recibe" maxLength={30} error={errors.documentoRecibe?.message} {...form.register('documentoRecibe')} />
    </div><AreaField id="entrega-observaciones" label="Observaciones" maxLength={500} error={errors.observaciones?.message} {...form.register('observaciones')} />
    <p className="text-sm text-muted-foreground">Responsable y fecha corresponden al servidor. Esta revisión no declara elegibilidad definitiva: la API deberá verificar permisos, estado, factura, saldo vigente y ausencia de entrega previa en una transacción. El modelo no define un flujo de crédito.</p>
    <DraftActions blocked={!orden || !permiteBorradorEntrega(orden)} blockedReason={ordenes === undefined ? 'Catálogo de órdenes pendiente de conexión.' : !ordenes.length ? 'El catálogo recibido no contiene órdenes.' : !orden ? 'Selecciona una orden para revisar sus requisitos.' : 'La orden seleccionada tiene requisitos incumplidos o pendientes de verificar. Revisa el detalle anterior.'} message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
