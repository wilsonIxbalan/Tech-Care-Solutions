import { zodResolver } from '@hookform/resolvers/zod'
import { Fragment, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label, RequiredMark } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { clienteSchema } from '@/features/clientes/cliente-schema'
import type { ClienteFormValues } from '@/features/clientes/cliente-schema'
import type { ClienteDto } from '@/types/domain'
import { useSession } from '@/features/auth/session-context'
import { clienteBody, useSaveCliente } from './api'
import { SaveError } from './save-error'

export function ClienteForm({ cliente, onCancel, onSaved }: { cliente?: ClienteDto; onCancel: () => void; onSaved: () => void }) {
  const { user } = useSession()
  const allowed = Boolean(user?.permisos.includes('CLIENTES_GESTIONAR'))
  const save = useSaveCliente(cliente?.idCliente)
  const sending = useRef(false)
  const [estado, setEstado] = useState<ClienteDto['estado']>(cliente?.estado ?? 'ACTIVO')
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    shouldUnregister: true,
    defaultValues: cliente ? {
      ...cliente, nombres: cliente.nombres ?? '', apellidos: cliente.apellidos ?? '',
      razonSocial: cliente.razonSocial ?? '', nombreContacto: cliente.nombreContacto ?? '',
      email: cliente.email ?? '', direccion: cliente.direccion ?? '',
    } : {
      tipoCliente: 'INDIVIDUAL',
      nombres: '',
      apellidos: '',
      nit: '',
      telefono: '',
      email: '',
      direccion: '',
    },
  })
  const tipoCliente = useWatch({ control: form.control, name: 'tipoCliente' })
  const { formState } = form
  const tipoError = formState.errors.tipoCliente

  function cancel() {
    form.reset()
    onCancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="cliente-form-title">{cliente ? 'Editar cliente' : 'Registrar cliente'}</CardTitle>
        <p className="text-sm text-muted-foreground">Los campos con * son obligatorios.</p>
        <p className="text-sm text-muted-foreground">
          Usa CF para consumidor final. Mantén los datos de contacto actualizados.
        </p>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby="cliente-form-title"
          className="space-y-5"
          noValidate
          onSubmit={async event => {
            event.preventDefault()
            if (!allowed || sending.current) return
            sending.current = true
            try {
              await form.handleSubmit(async values => {
                try { await save.mutateAsync(clienteBody(values, estado)); onSaved() } catch { /* Preserve values and show server details. */ }
              })(event)
            }
            finally { sending.current = false }
          }}
        >
          <fieldset disabled={!allowed || formState.isSubmitting} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="cliente-tipo">Tipo de cliente <RequiredMark /></Label>
            <NativeSelect
              id="cliente-tipo"
              autoFocus
              required
              aria-invalid={Boolean(tipoError)}
              aria-describedby={tipoError ? 'cliente-tipo-error' : undefined}
              {...form.register('tipoCliente')}
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="EMPRESARIAL">Empresarial</option>
            </NativeSelect>
            {tipoError && <p id="cliente-tipo-error" role="alert" className="text-xs text-destructive">{tipoError.message}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {tipoCliente === 'INDIVIDUAL' ? (
              <Fragment key="individual">
                <TextField
                  id="cliente-nombres"
                  placeholder="María José"
                  label="Nombres"
                  autoComplete="given-name"
                  required
                  maxLength={100}
                  error={form.getFieldState('nombres', formState).error?.message}
                  {...form.register('nombres')}
                />
                <TextField
                  id="cliente-apellidos"
                  placeholder="López Pérez"
                  label="Apellidos"
                  autoComplete="family-name"
                  required
                  maxLength={100}
                  error={form.getFieldState('apellidos', formState).error?.message}
                  {...form.register('apellidos')}
                />
              </Fragment>
            ) : (
              <Fragment key="empresarial">
                <TextField
                  id="cliente-razon-social"
                  placeholder="Tecnologías del Sur, S.A."
                  label="Razón social"
                  autoComplete="organization"
                  required
                  maxLength={150}
                  error={form.getFieldState('razonSocial', formState).error?.message}
                  {...form.register('razonSocial')}
                />
                <TextField
                  id="cliente-contacto"
                  placeholder="Nombre de la persona de contacto"
                  autoComplete="name"
                  label="Nombre de contacto"
                  maxLength={120}
                  error={form.getFieldState('nombreContacto', formState).error?.message}
                  {...form.register('nombreContacto')}
                />
              </Fragment>
            )}

            <TextField
              id="cliente-nit"
              label="NIT"
              placeholder="1234567-9 o CF"
              help="Incluye el dígito verificador; se acepta con o sin guion."
              required
              maxLength={20}
              error={formState.errors.nit?.message}
              {...form.register('nit')}
            />
            <TextField
              id="cliente-telefono"
              label="Teléfono"
              type="tel"
              inputMode="tel"
              placeholder="2222-3333"
              help="8 dígitos; prefijo +502 opcional."
              autoComplete="tel"
              required
              maxLength={20}
              error={formState.errors.telefono?.message}
              {...form.register('telefono')}
            />
            <TextField
              id="cliente-email"
              placeholder="nombre@empresa.com"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              maxLength={120}
              error={formState.errors.email?.message}
              {...form.register('email')}
            />
            <TextField
              id="cliente-direccion"
              placeholder="Calle, zona, municipio"
              label="Dirección"
              autoComplete="street-address"
              maxLength={250}
              error={formState.errors.direccion?.message}
              {...form.register('direccion')}
            />
          </div>

          <div className="space-y-2"><Label htmlFor="cliente-estado">Estado del cliente</Label><NativeSelect id="cliente-estado" value={estado} onChange={event => setEstado(event.target.value as ClienteDto['estado'])}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></NativeSelect></div>
          </fieldset>
          <SaveError error={save.error} />
          {!allowed && <p role="alert">No tienes permiso para gestionar clientes.</p>}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!allowed || formState.isSubmitting}>{formState.isSubmitting ? 'Guardando…' : 'Guardar cliente'}</Button>
            <Button type="button" variant="outline" disabled={formState.isSubmitting} onClick={cancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
