import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { ApiError, apiFetch } from '@/lib/api-client'
import { roleLabels } from '@/features/auth/roles'
import { createUsuarioSchema, usuarioPayload, type UsuarioValues, type UsuarioRow } from './usuario-model'
import type { RoleCode } from '@/types/api'

export function UsuarioForm({ usuario, roles, onCancel, onSaved }: { usuario?: UsuarioRow; roles: RoleCode[]; onCancel: () => void; onSaved: () => void }) {
  const form = useForm<UsuarioValues>({ resolver: zodResolver(createUsuarioSchema(Boolean(usuario))), defaultValues: { nombreUsuario: usuario?.nombreUsuario ?? '', nombreCompleto: usuario?.nombreCompleto ?? '', email: usuario?.email ?? '', telefono: usuario?.telefono ?? '', activo: usuario?.activo === false ? '0' : '1', password: '', roles: usuario?.roles ?? [] } })
  const selectedRoles = useWatch({ control: form.control, name: 'roles' })
  const [message, setMessage] = useState('')
  const client = useQueryClient()
  const save = useMutation({ gcTime: 0, mutationFn: async (value: UsuarioValues) => (await apiFetch<UsuarioRow>(usuario ? `/usuarios/${usuario.idUsuario}` : '/usuarios', { method: usuario ? 'PATCH' : 'POST', body: JSON.stringify(usuarioPayload(value)) })).data })
  const { errors, isSubmitting } = form.formState
  return <form aria-label={usuario ? 'Editar usuario' : 'Crear usuario'} className="space-y-5" noValidate onChange={() => setMessage('')} onSubmit={form.handleSubmit(async value => {
    setMessage('')
    try {
      await save.mutateAsync(value)
      form.reset()
      toast.success(usuario ? 'Usuario actualizado.' : 'Usuario creado.')
      await client.invalidateQueries({ queryKey: ['usuarios'] })
      if (usuario) await client.invalidateQueries({ queryKey: ['session'] })
      onSaved()
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'No pudimos guardar los cambios. Intenta nuevamente.')
      if (error instanceof ApiError && error.details) {
        let focused = false
        for (const key of ['nombreUsuario', 'nombreCompleto', 'email', 'telefono', 'password', 'roles', 'activo'] as const) {
          const detail = error.details[key]?.[0]
          if (detail) { form.setError(key, { message: detail }, { shouldFocus: !focused }); focused = true }
        }
      }
    }
  })}>
    <fieldset disabled={isSubmitting} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="usuario-nombre" label="Nombre de usuario" required maxLength={50} autoComplete="off" autoCapitalize="none" autoFocus error={errors.nombreUsuario?.message} {...form.register('nombreUsuario')} />
        <TextField id="usuario-completo" label="Nombre completo" required maxLength={150} error={errors.nombreCompleto?.message} {...form.register('nombreCompleto')} />
        <TextField id="usuario-email" label="Correo electrónico" required type="email" maxLength={120} error={errors.email?.message} {...form.register('email')} />
        <TextField id="usuario-telefono" label="Teléfono" type="tel" maxLength={20} error={errors.telefono?.message} {...form.register('telefono')} />
        <SelectField id="usuario-activo" label="Estado" required options={[{ value: '1', label: 'Activo' }, { value: '0', label: 'Inactivo' }]} error={errors.activo?.message} {...form.register('activo')} />
        <TextField id="usuario-password" label={usuario ? 'Nueva contraseña' : 'Contraseña inicial'} required={!usuario} type="password" autoComplete="new-password" maxLength={128} help={usuario ? 'Deja vacío para conservarla. Entre 12 y 128 caracteres al cambiarla.' : 'Entre 12 y 128 caracteres.'} error={errors.password?.message} {...form.register('password')} />
      </div>
      <fieldset aria-describedby={errors.roles ? 'usuario-roles-error' : undefined} className="space-y-3"><legend className="mb-3 text-sm font-medium">Roles *</legend><div className="flex flex-wrap gap-3">{roles.map(role => <label key={role} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-primary" value={role} checked={selectedRoles.includes(role)} aria-invalid={Boolean(errors.roles)} {...form.register('roles')} />{roleLabels[role]}</label>)}</div>{errors.roles && <p id="usuario-roles-error" role="alert" className="text-xs text-destructive">{errors.roles.message}</p>}</fieldset>
    </fieldset>
    {message && <p role="alert" className="rounded-lg border border-destructive/20 p-3 text-sm text-destructive">{message}</p>}
    <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={isSubmitting || !roles.length}>{isSubmitting ? 'Guardando…' : usuario ? 'Guardar cambios' : 'Crear usuario'}</Button></div>
  </form>
}
