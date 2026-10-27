import { useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AreaField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { ambiguousResult, confirmed, useSupplyAccess, useSupplyMutation } from '@/features/inventario/api'
import { SupplyError, SupplySelector } from '@/features/inventario/supply-controls'
import type { SupplyOption } from '@/features/inventario/supply-controls'
import { compraBody, createCompraSchema } from './compra-schema'
import type { CompraCatalogos } from './compra-schema'

const emptyLine = { idRepuesto: '', cantidad: '', costoUnitario: '' }
export function CompraForm({ catalogos = {}, onCancel, onSaved }: { catalogos: CompraCatalogos; onCancel: () => void; onSaved?: (id: number) => void }) {
  const { purchases } = useSupplyAccess()
  const sending = useRef(false)
  const [selected, setSelected] = useState<Record<string, SupplyOption | undefined>>({})
  // IDs are validated by SQL against the current active masters, not against a truncated list.
  const schema = createCompraSchema(catalogos, true)
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { idProveedor: '', idBodegaDestino: '', numeroDocumentoProveedor: '', observaciones: '', items: [{ ...emptyLine }] } })
  const lines = useFieldArray({ control: form.control, name: 'items' })
  const values = useWatch({ control: form.control })
  const save = useSupplyMutation<ReturnType<typeof compraBody>, { idCompra: number; numeroCompra: string; estado: string }>('/compras', 'POST', 'Compra registrada pendiente de recepción.', data => confirmed(data?.idCompra > 0 && typeof data.numeroCompra === 'string' && data.estado === 'PENDIENTE'))
  const { errors } = form.formState
  const blocked = !purchases || form.formState.isSubmitting || ambiguousResult(save.error)
  function select(key: string, option: SupplyOption | undefined) { setSelected(current => ({ ...current, [key]: option })) }
  return <form aria-label="Registrar compra" className="space-y-5 rounded-xl border p-4" noValidate onSubmit={async event => {
    event.preventDefault()
    if (sending.current || blocked) return
    sending.current = true
    try { await form.handleSubmit(async data => { try { const result = await save.mutateAsync(compraBody(data)); onSaved?.(result.idCompra) } catch { /* Preserve draft. */ } })(event) }
    finally { sending.current = false }
  }}>
    <fieldset disabled={blocked} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <SupplySelector resource="proveedores" label="Proveedor" id="compra-proveedor" active required disabled={blocked} value={values.idProveedor ?? ''} selected={selected.proveedor} options={catalogos.proveedores?.filter(p => p.estado === 'ACTIVO').map(p => ({ id: p.idProveedor, nombre: p.nombre }))} error={errors.idProveedor?.message} onSelect={option => { select('proveedor', option); form.setValue('idProveedor', option ? String(option.id) : '', { shouldValidate: true }) }} />
      <SupplySelector resource="bodegas" label="Bodega destino" id="compra-bodega" active required disabled={blocked} value={values.idBodegaDestino ?? ''} selected={selected.bodega} options={catalogos.bodegas?.filter(b => b.estado === 'ACTIVA').map(b => ({ id: b.idBodega, nombre: b.nombre }))} error={errors.idBodegaDestino?.message} onSelect={option => { select('bodega', option); form.setValue('idBodegaDestino', option ? String(option.id) : '', { shouldValidate: true }) }} />
      <TextField id="compra-documento" label="Documento del proveedor" maxLength={40} error={errors.numeroDocumentoProveedor?.message} {...form.register('numeroDocumentoProveedor')} />
    </div>
    <AreaField id="compra-observaciones" label="Observaciones" maxLength={500} error={errors.observaciones?.message} {...form.register('observaciones')} />
    <section aria-label="Detalle de compra" className="space-y-4"><h3 className="font-semibold">Detalle</h3>
      <p className="text-sm text-muted-foreground">Cada repuesto debe aparecer una sola vez. El costo será histórico de esta línea; no cambia el catálogo.</p>
      {lines.fields.map((line, index) => <fieldset key={line.id} className="min-w-0 space-y-3 rounded-lg border p-3"><legend>Línea {index + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <SupplySelector resource="repuestos" label={`Repuesto de línea ${index + 1}`} id={`compra-repuesto-${index}`} active required disabled={blocked} value={values.items?.[index]?.idRepuesto ?? ''} selected={selected[line.id]} options={catalogos.repuestos?.filter(r => r.estado === 'ACTIVO').map(r => ({ id: r.idRepuesto, nombre: `${r.codigo} · ${r.nombre}` }))} error={errors.items?.[index]?.idRepuesto?.message} onSelect={option => { select(line.id, option); form.setValue(`items.${index}.idRepuesto`, option ? String(option.id) : '', { shouldValidate: true }) }} />
          <TextField id={`compra-cantidad-${index}`} label="Cantidad" required inputMode="numeric" error={errors.items?.[index]?.cantidad?.message} {...form.register(`items.${index}.cantidad`)} />
          <TextField id={`compra-costo-${index}`} label="Costo unitario" required inputMode="decimal" help="Hasta dos decimales; se permite cero." error={errors.items?.[index]?.costoUnitario?.message} {...form.register(`items.${index}.costoUnitario`)} />
        </div><Button type="button" variant="outline" aria-label={`Quitar línea ${index + 1}`} onClick={() => lines.remove(index)}>Quitar línea</Button>
      </fieldset>)}
      {(errors.items?.root?.message || errors.items?.message) && <p role="alert">{errors.items.root?.message ?? errors.items.message}</p>}
      <Button type="button" variant="outline" disabled={lines.fields.length >= 500} onClick={() => lines.append({ ...emptyLine })}>Agregar línea</Button>
    </section>
    </fieldset>
    <p className="text-sm text-muted-foreground">La compra se registra pendiente de recepción. Confirma su llegada a bodega para actualizar las existencias.</p>
    <SupplyError error={save.error} />
    <div className="flex gap-3"><Button type="submit" disabled={blocked}>{form.formState.isSubmitting ? 'Registrando…' : 'Registrar compra'}</Button><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={onCancel}>Cerrar</Button></div>
  </form>
}
