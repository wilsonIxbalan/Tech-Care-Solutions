import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, AreaField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import { proveedorSchema } from './proveedor-schema'

export function ProveedorForm({ onCancel }: { onCancel: () => void }) {
  const form = useForm<z.infer<typeof proveedorSchema>>({ resolver: zodResolver(proveedorSchema), defaultValues: { nit: '', nombre: '', nombreContacto: '', telefono: '', email: '', direccion: '' } })
  const [message, setMessage] = useState('')
  const { errors } = form.formState
  return <form aria-label="Borrador de proveedor" noValidate className="space-y-5" onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Datos válidos. El proveedor aún no se ha guardado; falta conectar la API.'), () => setMessage(''))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField id="proveedor-nit" label="NIT" required maxLength={20} error={errors.nit?.message} {...form.register('nit')} />
      <TextField id="proveedor-nombre" label="Nombre" required maxLength={150} error={errors.nombre?.message} {...form.register('nombre')} />
      <TextField id="proveedor-contacto" label="Nombre de contacto" maxLength={120} error={errors.nombreContacto?.message} {...form.register('nombreContacto')} />
      <TextField id="proveedor-telefono" label="Teléfono" type="tel" required maxLength={20} error={errors.telefono?.message} {...form.register('telefono')} />
      <TextField id="proveedor-email" label="Correo electrónico" type="email" maxLength={120} error={errors.email?.message} {...form.register('email')} />
    </div>
    <AreaField id="proveedor-direccion" label="Dirección" maxLength={250} error={errors.direccion?.message} {...form.register('direccion')} />
    <p className="text-sm text-muted-foreground">El servidor comprobará que el NIT sea único. Falta acordar el formato del NIT y del teléfono.</p>
    <DraftActions message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
