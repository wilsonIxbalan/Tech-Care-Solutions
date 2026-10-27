import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { AreaField, SelectField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import type { InventarioDto } from '@/types/domain'
import { ambiguousResult, confirmed, useSupplyAccess, useSupplyMutation } from './api'
import { SupplyError, SupplySelector } from './supply-controls'
import type { SupplyOption } from './supply-controls'
import { ajusteBody, ajusteSchema, minimoSchema } from './inventario-schema'

export function AjusteForm({ onCancel, onSaved }: { onCancel: () => void; onSaved?: () => void }) {
  const { inventoryWrite } = useSupplyAccess()
  const sending = useRef(false)
  const [selected, setSelected] = useState<{ bodega?: SupplyOption; repuesto?: SupplyOption }>({})
  const form = useForm<z.infer<typeof ajusteSchema>>({ resolver: zodResolver(ajusteSchema), defaultValues: { idBodega: '', idRepuesto: '', codigoTipoMovimiento: 'AJUSTE_ENTRADA', cantidad: '', observacion: '' } })
  const values = useWatch({ control: form.control })
  const save = useSupplyMutation<ReturnType<typeof ajusteBody>, { idBodega: number; idRepuesto: number; existenciaResultante: number }>('/inventario/ajustes', 'POST', 'Ajuste registrado.', data => confirmed(data?.idBodega === Number(values.idBodega) && data.idRepuesto === Number(values.idRepuesto) && Number.isInteger(data.existenciaResultante) && data.existenciaResultante >= 0))
  const { errors } = form.formState
  const blocked = !inventoryWrite || form.formState.isSubmitting || ambiguousResult(save.error)
  return <form aria-label="Ajustar inventario" noValidate className="space-y-4 rounded-xl border p-4" onSubmit={async event => {
    event.preventDefault()
    if (sending.current || blocked) return
    sending.current = true
    try { await form.handleSubmit(async data => { try { await save.mutateAsync(ajusteBody(data)); onSaved?.() } catch { /* Keep values. */ } })(event) }
    finally { sending.current = false }
  }}>
    <fieldset disabled={blocked} className="space-y-4"><h3 className="font-semibold">Ajuste de inventario</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <SupplySelector resource="bodegas" label="Bodega del ajuste" id="ajuste-bodega" required active disabled={blocked} value={values.idBodega ?? ''} selected={selected.bodega} error={errors.idBodega?.message} onSelect={option => { setSelected({ ...selected, bodega: option }); form.setValue('idBodega', option ? String(option.id) : '', { shouldValidate: true }) }} />
        <SupplySelector resource="repuestos" label="Repuesto del ajuste" id="ajuste-repuesto" required active disabled={blocked} value={values.idRepuesto ?? ''} selected={selected.repuesto} error={errors.idRepuesto?.message} onSelect={option => { setSelected({ ...selected, repuesto: option }); form.setValue('idRepuesto', option ? String(option.id) : '', { shouldValidate: true }) }} />
        <SelectField id="ajuste-tipo" label="Tipo de ajuste" required options={[{ value: 'AJUSTE_ENTRADA', label: 'Entrada' }, { value: 'AJUSTE_SALIDA', label: 'Salida' }]} error={errors.codigoTipoMovimiento?.message} {...form.register('codigoTipoMovimiento')} />
        <TextField id="ajuste-cantidad" label="Cantidad del ajuste" required inputMode="numeric" help="Cantidad positiva; selecciona entrada o salida. No es la existencia final." error={errors.cantidad?.message} {...form.register('cantidad')} />
      </div>
      <AreaField id="ajuste-observacion" label="Motivo del ajuste" required maxLength={300} error={errors.observacion?.message} {...form.register('observacion')} />
    </fieldset>
    <SupplyError error={save.error} />
    <div className="flex gap-3"><Button type="submit" disabled={blocked}>{form.formState.isSubmitting ? 'Registrando…' : 'Registrar ajuste'}</Button><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={onCancel}>Cerrar</Button></div>
  </form>
}

export function MinimoForm({ row, onCancel, onSaved }: { row: InventarioDto; onCancel: () => void; onSaved?: () => void }) {
  const { inventoryWrite } = useSupplyAccess()
  const sending = useRef(false)
  const form = useForm<z.infer<typeof minimoSchema>>({ resolver: zodResolver(minimoSchema), defaultValues: { stockMinimo: String(row.stockMinimo) } })
  const save = useSupplyMutation<{ stockMinimo: number }, { idBodega: number; idRepuesto: number; stockMinimo: number }>(`/inventario/${row.idBodega}/${row.idRepuesto}/stock-minimo`, 'PATCH', 'Stock mínimo actualizado.', data => confirmed(data?.idBodega === row.idBodega && data.idRepuesto === row.idRepuesto && data.stockMinimo === Number(form.getValues('stockMinimo'))))
  const blocked = !inventoryWrite || form.formState.isSubmitting || ambiguousResult(save.error)
  return <form aria-label="Modificar stock mínimo" noValidate className="space-y-4 rounded-xl border p-4" onSubmit={async event => {
    event.preventDefault()
    if (sending.current || blocked) return
    sending.current = true
    try { await form.handleSubmit(async values => { try { await save.mutateAsync({ stockMinimo: Number(values.stockMinimo) }); onSaved?.() } catch { /* Keep values. */ } })(event) }
    finally { sending.current = false }
  }}>
    <p>{row.bodegaNombre} · {row.codigoRepuesto} · {row.repuestoNombre}</p>
    <TextField id="stock-minimo" label="Stock mínimo" required inputMode="numeric" disabled={blocked} help="Permite cero. No modifica existencias ni genera movimientos." error={form.formState.errors.stockMinimo?.message} {...form.register('stockMinimo')} />
    <SupplyError error={save.error} />
    <div className="flex gap-3"><Button type="submit" disabled={blocked}>{form.formState.isSubmitting ? 'Guardando…' : 'Guardar mínimo'}</Button><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={onCancel}>Cerrar</Button></div>
  </form>
}
