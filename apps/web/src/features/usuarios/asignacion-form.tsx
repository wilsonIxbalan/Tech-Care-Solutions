import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SelectField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import { createAsignacionSchema } from './usuario-model'
import type { UsuarioRow, RolRow, AsignacionRow } from './usuario-model'

export function AsignacionForm({ usuarios, roles, asignaciones, onCancel }: { usuarios?: readonly UsuarioRow[]; roles?: readonly RolRow[]; asignaciones?: readonly AsignacionRow[]; onCancel: () => void }) {
  const schema = createAsignacionSchema(usuarios, roles, asignaciones)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { idUsuario: '', idRol: '' } })
  const idUsuario = useWatch({ control: form.control, name: 'idUsuario' })
  const disponibles = roles?.filter(r => !asignaciones?.some(a => String(a.idUsuario) === idUsuario && a.idRol === r.idRol))
  const [message, setMessage] = useState('')
  const { errors } = form.formState
  return <form aria-label="Borrador de asignación de rol" className="space-y-5" noValidate onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Asignación preliminar válida. Todavía no se ha asignado el rol ni cambiado permisos; falta conectar la API.'), () => setMessage(''))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField id="asignacion-usuario" label="Usuario" required options={usuarios?.map(u => ({ value: String(u.idUsuario), label: `${u.nombreCompleto} · ${u.activo ? 'Activo' : 'Inactivo'}` }))} error={errors.idUsuario?.message} {...form.register('idUsuario', { onChange: () => form.resetField('idRol') })} />
      <SelectField id="asignacion-rol" label="Rol" required options={disponibles?.map(r => ({ value: String(r.idRol), label: `${r.nombre} · ${r.activo ? 'Activo' : 'Inactivo'}` }))} error={errors.idRol?.message} {...form.register('idRol')} />
    </div>
    <p className="text-sm text-muted-foreground">No se repiten pares usuario/rol. SQL calcula permisos efectivos con usuario y rol activos; asignar un rol no autentica a nadie. La fecha de asignación será del servidor. Dar o retirar roles exige autorización real de la API.</p>
    <DraftActions blocked={!usuarios?.length || !disponibles?.length || asignaciones === undefined} message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
