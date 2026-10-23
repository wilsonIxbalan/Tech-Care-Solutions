import { useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AreaField, SelectField, TextField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import { Button } from '@/components/ui/button'
import { createCompraSchema, estimatePurchase } from './compra-schema'
import type { CompraCatalogos } from './compra-schema'

const emptyLine = { idRepuesto: '', cantidad: '', costoUnitario: '' }
export function CompraForm({ catalogos, onCancel }: { catalogos: CompraCatalogos; onCancel: () => void }) {
  const schema = createCompraSchema(catalogos)
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { idProveedor: '', idBodegaDestino: '', numeroDocumentoProveedor: '', observaciones: '', items: [{ ...emptyLine }] } })
  const lines = useFieldArray({ control: form.control, name: 'items' })
  const items = useWatch({ control: form.control, name: 'items' })
  const estimate = estimatePurchase(items)
  const [message, setMessage] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)
  const { errors } = form.formState
  const proveedores = catalogos.proveedores?.filter(p => p.estado === 'ACTIVO')
  const bodegas = catalogos.bodegas?.filter(b => b.estado === 'ACTIVA')
  const repuestos = catalogos.repuestos?.filter(r => r.estado === 'ACTIVO')
  return <form aria-label="Borrador de compra" className="space-y-5" noValidate onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Borrador válido. La compra aún no se ha guardado ni recibido; falta conectar la API.'), () => setMessage(''))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField id="compra-proveedor" label="Proveedor" required options={proveedores?.map(p => ({ value: String(p.idProveedor), label: p.nombre }))} error={errors.idProveedor?.message} {...form.register('idProveedor')} />
      <SelectField id="compra-bodega" label="Bodega destino" required options={bodegas?.map(b => ({ value: String(b.idBodega), label: b.nombre }))} error={errors.idBodegaDestino?.message} {...form.register('idBodegaDestino')} />
      <TextField id="compra-documento" label="Documento del proveedor" maxLength={40} error={errors.numeroDocumentoProveedor?.message} {...form.register('numeroDocumentoProveedor')} />
    </div>
    <AreaField id="compra-observaciones" label="Observaciones" maxLength={500} error={errors.observaciones?.message} {...form.register('observaciones')} />
    <section aria-label="Detalle del borrador" className="space-y-4"><h3 className="font-semibold">Detalle</h3>
      <p className="text-sm text-muted-foreground">Cada repuesto debe aparecer una sola vez. El costo introducido será el costo histórico de esa línea; no cambia el precio de referencia del catálogo.</p>
      {lines.fields.map((line, index) => <fieldset key={line.id} className="min-w-0 space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Línea {index + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField id={`compra-repuesto-${index}`} label="Repuesto" required options={repuestos?.map(r => ({ value: String(r.idRepuesto), label: `${r.codigo} · ${r.nombre}` }))} error={errors.items?.[index]?.idRepuesto?.message} {...form.register(`items.${index}.idRepuesto`)} />
          <TextField id={`compra-cantidad-${index}`} label="Cantidad" required inputMode="numeric" error={errors.items?.[index]?.cantidad?.message} {...form.register(`items.${index}.cantidad`)} />
          <TextField id={`compra-costo-${index}`} label="Costo unitario" required inputMode="decimal" help="Punto decimal, hasta dos decimales; se permite cero." error={errors.items?.[index]?.costoUnitario?.message} {...form.register(`items.${index}.costoUnitario`)} />
        </div><Button variant="outline" aria-label={`Quitar línea ${index + 1}`} onClick={() => { lines.remove(index); setMessage(''); addButton.current?.focus() }}>Quitar línea</Button>
      </fieldset>)}
      {(errors.items?.root?.message || errors.items?.message) && <p role="alert" className="text-sm text-destructive">{errors.items.root?.message ?? errors.items.message}</p>}
      <Button ref={addButton} variant="outline" onClick={() => { lines.append({ ...emptyLine }, { focusName: `items.${lines.fields.length}.idRepuesto` }); setMessage('') }}>Agregar línea</Button>
    </section>
    <p className="rounded-lg border p-3 text-sm">Estimación del borrador (Q): <strong>{estimate ?? 'Completa cantidades y costos válidos'}</strong>. El servidor será autoridad del total final.</p>
    <p className="text-sm text-muted-foreground">Número, usuario y fecha de compra serán generados o confirmados por el servidor. Iniciará PENDIENTE; recibirla y aumentar inventario requieren una transacción de la API.</p>
    <DraftActions blocked={!proveedores?.length || !bodegas?.length || !repuestos?.length} message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
