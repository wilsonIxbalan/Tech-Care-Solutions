import { zodResolver } from '@hookform/resolvers/zod'
import { Fragment, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { FieldError } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { clienteSchema } from '@/features/clientes/cliente-schema'
import type { ClienteFormValues } from '@/features/clientes/cliente-schema'
import type { ClienteDto } from '@/types/domain'
import { useSession } from '@/features/auth/session-context'
import { clienteBody, useSaveCliente } from './api'
import { SaveError } from './save-error'

type ClienteFieldProps = ComponentProps<'input'> & {
  id: string
  label: string
  error?: FieldError
}

function ClienteField({ id, label, error, required, ...props }: ClienteFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required && ' *'}</Label>
      <Input
        {...props}
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error.message}
        </p>
      )}
    </div>
  )
}

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
            <Label htmlFor="cliente-tipo">Tipo de cliente *</Label>
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
                <ClienteField
                  id="cliente-nombres"
                  label="Nombres"
                  autoComplete="given-name"
                  required
                  error={form.getFieldState('nombres', formState).error}
                  {...form.register('nombres')}
                />
                <ClienteField
                  id="cliente-apellidos"
                  label="Apellidos"
                  autoComplete="family-name"
                  required
                  error={form.getFieldState('apellidos', formState).error}
                  {...form.register('apellidos')}
                />
              </Fragment>
            ) : (
              <Fragment key="empresarial">
                <ClienteField
                  id="cliente-razon-social"
                  label="Razón social"
                  autoComplete="organization"
                  required
                  error={form.getFieldState('razonSocial', formState).error}
                  {...form.register('razonSocial')}
                />
                <ClienteField
                  id="cliente-contacto"
                  label="Nombre de contacto"
                  error={form.getFieldState('nombreContacto', formState).error}
                  {...form.register('nombreContacto')}
                />
              </Fragment>
            )}

            <ClienteField
              id="cliente-nit"
              label="NIT"
              placeholder="NIT del cliente"
              required
              error={formState.errors.nit}
              {...form.register('nit')}
            />
            <ClienteField
              id="cliente-telefono"
              label="Teléfono"
              type="tel"
              autoComplete="tel"
              required
              error={formState.errors.telefono}
              {...form.register('telefono')}
            />
            <ClienteField
              id="cliente-email"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              error={formState.errors.email}
              {...form.register('email')}
            />
            <ClienteField
              id="cliente-direccion"
              label="Dirección"
              autoComplete="street-address"
              error={formState.errors.direccion}
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
