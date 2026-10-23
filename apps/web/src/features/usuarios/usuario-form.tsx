import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import { usuarioSchema } from './usuario-model'

export function UsuarioForm({ onCancel }: { onCancel: () => void }) {
  const form = useForm<z.infer<typeof usuarioSchema>>({ resolver: zodResolver(usuarioSchema), defaultValues: { nombreUsuario: '', nombreCompleto: '', email: '', telefono: '', activo: '1' } })
  const [message, setMessage] = useState('')
  const { errors } = form.formState
  return <form aria-label="Borrador de perfil de usuario" className="space-y-5" noValidate onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Datos del perfil válidos. Todavía no se ha creado ni guardado una cuenta; falta acordar e integrar el alta segura con la API.'), () => setMessage(''))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField id="usuario-nombre" label="Nombre de usuario" required maxLength={50} autoComplete="off" error={errors.nombreUsuario?.message} {...form.register('nombreUsuario')} />
      <TextField id="usuario-completo" label="Nombre completo" required maxLength={150} error={errors.nombreCompleto?.message} {...form.register('nombreCompleto')} />
      <TextField id="usuario-email" label="Correo electrónico" required type="email" maxLength={120} error={errors.email?.message} {...form.register('email')} />
      <TextField id="usuario-telefono" label="Teléfono" type="tel" maxLength={20} error={errors.telefono?.message} {...form.register('telefono')} />
      <SelectField id="usuario-activo" label="Estado del perfil" required options={[{ value: '1', label: 'Activo' }, { value: '0', label: 'Inactivo' }]} error={errors.activo?.message} {...form.register('activo')} />
    </div>
    <p className="text-sm text-muted-foreground">Este borrador sólo prepara el perfil. No solicita ni almacena contraseñas o hashes. La creación de credenciales, su política, recuperación y entrega segura de acceso deben acordarse con backend. Identificador, fechas e intentos fallidos son datos del servidor.</p>
    <DraftActions message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
