import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { EquipoCatalogos } from '@/features/equipos/equipo-catalogos'
import { createEquipoSchema } from '@/features/equipos/equipo-schema'
import type { EquipoFormInput, EquipoFormValues } from '@/features/equipos/equipo-schema'

function CatalogSelect({ label, catalogName, options, registration, error }: {
  label: string
  catalogName: string
  options?: readonly { id: number; nombre: string }[]
  registration: UseFormRegisterReturn
  error?: FieldError
}) {
  const id = `equipo-${registration.name}`
  const available = Boolean(options?.length)
  const help = options === undefined
    ? `Catálogo de ${catalogName} pendiente de conexión.`
    : available
      ? 'Selecciona una opción del catálogo recibido.'
      : `El catálogo recibido de ${catalogName} no contiene opciones.`

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} *</Label>
      <NativeSelect
        {...registration}
        id={id}
        required
        disabled={!available}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      >
        <option value="">{available ? 'Selecciona una opción' : options === undefined ? 'Pendiente de conexión' : 'Catálogo sin opciones'}</option>
        {options?.map(option => <option key={option.id} value={option.id}>{option.nombre}</option>)}
      </NativeSelect>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error.message}</p>}
    </div>
  )
}

export function EquipoForm({ catalogos, onCancel }: { catalogos: EquipoCatalogos; onCancel: () => void }) {
  const [message, setMessage] = useState('')
  const form = useForm<EquipoFormInput, unknown, EquipoFormValues>({
    resolver: zodResolver(createEquipoSchema(catalogos)),
    defaultValues: {
      idCliente: '',
      idTipoEquipo: '',
      idMarca: '',
      modelo: '',
      numeroSerie: '',
      descripcion: '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const catalogosDisponibles = Boolean(catalogos.clientes?.length && catalogos.tiposEquipo?.length && catalogos.marcas?.length)

  function cancel() {
    form.reset()
    setMessage('')
    onCancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="equipo-form-title">Registrar equipo</CardTitle>
        <p className="text-sm text-muted-foreground">Los campos con * son obligatorios.</p>
        <p className="text-sm text-muted-foreground">El guardado está pendiente de conectar la API.</p>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby="equipo-form-title"
          className="space-y-5"
          noValidate
          onChange={() => setMessage('')}
          onSubmit={form.handleSubmit(
            () => setMessage('Los datos son válidos. El equipo aún no se ha guardado: falta conectar la API.'),
            () => setMessage(''),
          )}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <CatalogSelect
              label="Cliente propietario"
              catalogName="clientes"
              options={catalogos.clientes?.map(cliente => ({ id: cliente.idCliente, nombre: cliente.nombreMostrar }))}
              registration={form.register('idCliente')}
              error={errors.idCliente}
            />
            <CatalogSelect
              label="Tipo de equipo"
              catalogName="tipos de equipo"
              options={catalogos.tiposEquipo?.map(tipo => ({ id: tipo.idTipoEquipo, nombre: tipo.nombre }))}
              registration={form.register('idTipoEquipo')}
              error={errors.idTipoEquipo}
            />
            <CatalogSelect
              label="Marca"
              catalogName="marcas"
              options={catalogos.marcas?.map(marca => ({ id: marca.idMarca, nombre: marca.nombre }))}
              registration={form.register('idMarca')}
              error={errors.idMarca}
            />
            <div className="space-y-2">
              <Label htmlFor="equipo-modelo">Modelo *</Label>
              <Input
                id="equipo-modelo"
                required
                aria-invalid={Boolean(errors.modelo)}
                aria-describedby={errors.modelo ? 'equipo-modelo-error' : undefined}
                {...form.register('modelo')}
              />
              {errors.modelo && <p id="equipo-modelo-error" role="alert" className="text-xs text-destructive">{errors.modelo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipo-numero-serie">Número de serie *</Label>
              <Input
                id="equipo-numero-serie"
                required
                aria-invalid={Boolean(errors.numeroSerie)}
                aria-describedby={errors.numeroSerie ? 'equipo-numero-serie-error' : undefined}
                {...form.register('numeroSerie')}
              />
              {errors.numeroSerie && <p id="equipo-numero-serie-error" role="alert" className="text-xs text-destructive">{errors.numeroSerie.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipo-descripcion">Descripción</Label>
            <Textarea
              id="equipo-descripcion"
              aria-invalid={Boolean(errors.descripcion)}
              aria-describedby={errors.descripcion ? 'equipo-descripcion-error' : undefined}
              {...form.register('descripcion')}
            />
            {errors.descripcion && <p id="equipo-descripcion-error" role="alert" className="text-xs text-destructive">{errors.descripcion.message}</p>}
          </div>

          {!catalogosDisponibles && (
            <p id="equipo-catalogos-pendientes" className="rounded-lg border bg-muted p-3 text-sm">
              La validación completa está bloqueada hasta disponer de clientes, tipos de equipo y marcas para seleccionar.
            </p>
          )}
          {message && catalogosDisponibles && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{message}</p>}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={!catalogosDisponibles || isSubmitting}
              aria-describedby={!catalogosDisponibles ? 'equipo-catalogos-pendientes' : undefined}
            >
              Validar datos
            </Button>
            <Button type="button" variant="outline" onClick={cancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
