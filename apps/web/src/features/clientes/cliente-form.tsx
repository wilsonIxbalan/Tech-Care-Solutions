import { zodResolver } from '@hookform/resolvers/zod'
import { Fragment, useState } from 'react'
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

export function ClienteForm({ onCancel }: { onCancel: () => void }) {
  const [message, setMessage] = useState('')
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    shouldUnregister: true,
    defaultValues: {
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
    setMessage('')
    onCancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="cliente-form-title">Registrar cliente</CardTitle>
        <p className="text-sm text-muted-foreground">Los campos con * son obligatorios.</p>
        <p className="text-sm text-muted-foreground">
          Puedes validar los datos. El guardado está pendiente de conectar la API.
        </p>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby="cliente-form-title"
          className="space-y-5"
          noValidate
          onChange={() => setMessage('')}
          onSubmit={form.handleSubmit(
            () => setMessage('Los datos son válidos. El cliente aún no se ha guardado: falta conectar la API.'),
            () => setMessage(''),
          )}
        >
          <div className="space-y-2">
            <Label htmlFor="cliente-tipo">Tipo de cliente *</Label>
            <NativeSelect
              id="cliente-tipo"
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

          {message && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{message}</p>}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={formState.isSubmitting}>Validar datos</Button>
            <Button type="button" variant="outline" onClick={cancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
