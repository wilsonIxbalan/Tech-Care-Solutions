import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, AreaField, SelectField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { ambiguousResult, confirmed, useSupplyAccess, useSupplyMutation } from '@/features/inventario/api'
import { SupplyError } from '@/features/inventario/supply-controls'
import { proveedorSchema } from './proveedor-schema'
import type { ProveedorRow } from './proveedor-schema'

export function ProveedorForm({ onCancel, proveedor, onSaved }: { onCancel: () => void; proveedor?: ProveedorRow; onSaved?: () => void }) {
  const { supplierWrite } = useSupplyAccess()
  const sending = useRef(false)
  const [estado, setEstado] = useState(proveedor?.estado ?? 'ACTIVO')
  type Body = { nit: string; nombre: string; telefono: string; nombreContacto: string | null; email: string | null; direccion: string | null; estado: string }
  const save = useSupplyMutation<Body, ProveedorRow>(proveedor ? `/proveedores/${proveedor.idProveedor}` : '/proveedores', proveedor ? 'PATCH' : 'POST', 'Proveedor guardado.', data => confirmed(data?.idProveedor > 0))
  const form = useForm<z.infer<typeof proveedorSchema>>({ resolver: zodResolver(proveedorSchema), defaultValues: proveedor ? { ...proveedor, nombreContacto: proveedor.nombreContacto ?? '', email: proveedor.email ?? '', direccion: proveedor.direccion ?? '' } : { nit: '', nombre: '', nombreContacto: '', telefono: '', email: '', direccion: '' } })
  const { errors } = form.formState
  const blocked = !supplierWrite || form.formState.isSubmitting || ambiguousResult(save.error)
  return <form aria-label={proveedor ? 'Editar proveedor' : 'Registrar proveedor'} noValidate className="space-y-5 rounded-xl border p-4" onSubmit={async event => {
    event.preventDefault()
    if (sending.current || blocked) return
    sending.current = true
    try { await form.handleSubmit(async values => { try { await save.mutateAsync({ ...values, nombreContacto: values.nombreContacto || null, email: values.email || null, direccion: values.direccion || null, estado }); onSaved?.() } catch { /* Keep values and details. */ } })(event) }
    finally { sending.current = false }
  }}>
    <fieldset disabled={blocked} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField id="proveedor-nit" placeholder="1234567-9" autoComplete="off" label="NIT" required maxLength={20} error={errors.nit?.message} {...form.register('nit')} />
      <TextField id="proveedor-nombre" placeholder="Distribuidora Tecnológica, S.A." autoComplete="organization" label="Nombre" required maxLength={150} error={errors.nombre?.message} {...form.register('nombre')} />
      <TextField id="proveedor-contacto" placeholder="Nombre de la persona de contacto" autoComplete="name" label="Nombre de contacto" maxLength={120} error={errors.nombreContacto?.message} {...form.register('nombreContacto')} />
      <TextField id="proveedor-telefono" inputMode="tel" placeholder="5555 1234" autoComplete="tel" label="Teléfono" type="tel" required maxLength={20} error={errors.telefono?.message} {...form.register('telefono')} />
      <TextField id="proveedor-email" placeholder="nombre@empresa.com" autoComplete="email" label="Correo electrónico" type="email" maxLength={120} error={errors.email?.message} {...form.register('email')} />
    </div>
    <AreaField id="proveedor-direccion" placeholder="Calle, zona, municipio" autoComplete="street-address" label="Dirección" maxLength={250} error={errors.direccion?.message} {...form.register('direccion')} />
    <SelectField id="proveedor-estado" label="Estado del proveedor" value={estado} options={['ACTIVO', 'INACTIVO'].map(value => ({ value, label: value }))} onChange={e => setEstado(e.target.value as ProveedorRow['estado'])} />
    </fieldset>
    <SupplyError error={save.error} />
    <div className="flex gap-3"><Button type="submit" disabled={blocked}>{form.formState.isSubmitting ? 'Guardando…' : 'Guardar proveedor'}</Button><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={onCancel}>Cerrar</Button></div>
  </form>
}
