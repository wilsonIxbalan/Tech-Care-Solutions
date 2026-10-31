import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, AreaField, SelectField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { ambiguousResult, confirmed, useSupplyAccess, useSupplyMutation } from '@/features/inventario/api'
import { SupplyError } from '@/features/inventario/supply-controls'
import { createRepuestoSchema } from './repuesto-model'
import type { CategoriaOption, RepuestoRow } from './repuesto-model'

export function RepuestoForm({ categorias, onCancel, repuesto, onSaved }: { categorias?: readonly CategoriaOption[]; onCancel: () => void; repuesto?: RepuestoRow; onSaved?: () => void }) {
  const { partsWrite } = useSupplyAccess()
  const sending = useRef(false)
  const [estado, setEstado] = useState(repuesto?.estado ?? 'ACTIVO')
  const schema = createRepuestoSchema(categorias)
  type Body = Omit<z.output<typeof schema>, 'idCategoria' | 'descripcion'> & { idCategoria: number; estado: string; descripcion: string | null }
  const save = useSupplyMutation<Body, RepuestoRow>(repuesto ? `/repuestos/${repuesto.idRepuesto}` : '/repuestos', repuesto ? 'PATCH' : 'POST', 'Repuesto guardado.', data => confirmed(data?.idRepuesto > 0))
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: repuesto ? { ...repuesto, idCategoria: String(repuesto.idCategoria), descripcion: repuesto.descripcion ?? '' } : { idCategoria: '', codigo: '', nombre: '', descripcion: '', precioCompraReferencia: '', precioVenta: '' } })
  const { errors } = form.formState
  const blocked = !partsWrite || !categorias?.length || form.formState.isSubmitting || ambiguousResult(save.error)
  return <form aria-label={repuesto ? 'Editar repuesto' : 'Registrar repuesto'} noValidate className="space-y-5 rounded-xl border p-4" onSubmit={async event => {
    event.preventDefault()
    if (sending.current || blocked) return
    sending.current = true
    try { await form.handleSubmit(async values => { try { await save.mutateAsync({ ...values, descripcion: values.descripcion || null, idCategoria: Number(values.idCategoria), estado }); onSaved?.() } catch { /* Keep values and details. */ } })(event) }
    finally { sending.current = false }
  }}>
    <fieldset disabled={blocked} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField id="repuesto-categoria" label="Categoría" required options={categorias?.map(c => ({ value: String(c.idCategoria), label: c.nombre }))} error={errors.idCategoria?.message} {...form.register('idCategoria')} />
      <TextField id="repuesto-codigo" placeholder="RAM-DDR4-8G" autoComplete="off" autoCapitalize="characters" label="Código" required readOnly={Boolean(repuesto)} help={repuesto ? 'El código no puede modificarse.' : undefined} maxLength={30} error={errors.codigo?.message} {...form.register('codigo')} />
      <TextField id="repuesto-nombre" placeholder="Memoria RAM DDR4 8 GB" autoComplete="off" label="Nombre" required maxLength={120} error={errors.nombre?.message} {...form.register('nombre')} />
      <TextField id="repuesto-compra" placeholder="0.00" autoComplete="off" label="Precio de compra de referencia" required inputMode="decimal" help="Punto decimal, hasta dos decimales. Se permite cero." error={errors.precioCompraReferencia?.message} {...form.register('precioCompraReferencia')} />
      <TextField id="repuesto-venta" placeholder="0.00" autoComplete="off" label="Precio de venta" required inputMode="decimal" help="Punto decimal, hasta dos decimales. Se permite cero." error={errors.precioVenta?.message} {...form.register('precioVenta')} />
    </div>
    <AreaField id="repuesto-descripcion" placeholder="Compatibilidad o detalles (opcional)" label="Descripción" maxLength={300} error={errors.descripcion?.message} {...form.register('descripcion')} />
    <SelectField id="repuesto-estado" label="Estado del repuesto" value={estado} options={['ACTIVO', 'INACTIVO'].map(value => ({ value, label: value }))} onChange={e => setEstado(e.target.value as RepuestoRow['estado'])} />
    </fieldset>
    <p className="text-sm text-muted-foreground">Usa un código único para cada repuesto. Los cambios del catálogo no modifican existencias.</p>
    <SupplyError error={save.error} />
    {!categorias?.length && <p role="status">No hay categorías disponibles para guardar.</p>}
    <div className="flex gap-3"><Button type="submit" disabled={blocked}>{form.formState.isSubmitting ? 'Guardando…' : 'Guardar repuesto'}</Button><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={onCancel}>Cerrar</Button></div>
  </form>
}
