import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { OrdenCatalogos } from '@/features/ordenes/orden-catalogos'
import { createOrdenSchema } from '@/features/ordenes/orden-schema'
import type { OrdenFormInput, OrdenFormValues } from '@/features/ordenes/orden-schema'

function OrdenSelect({ label, options, help, registration, error }: {
  label: string
  options?: readonly { id: number; nombre: string }[]
  help: string
  registration: UseFormRegisterReturn
  error?: FieldError
}) {
  const id = `orden-${registration.name}`

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} *</Label>
      <NativeSelect
        {...registration}
        id={id}
        required
        disabled={!options?.length}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      >
        <option value="">{options === undefined ? 'Pendiente de conexión' : 'Selecciona una opción'}</option>
        {options?.map(option => <option key={option.id} value={option.id}>{option.nombre}</option>)}
      </NativeSelect>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error.message}</p>}
    </div>
  )
}

export function OrdenForm({ catalogos, onCancel }: { catalogos: OrdenCatalogos; onCancel: () => void }) {
  const [message, setMessage] = useState('')
  const form = useForm<OrdenFormInput, unknown, OrdenFormValues>({
    resolver: zodResolver(createOrdenSchema(catalogos)),
    defaultValues: {
      idCliente: '', idEquipo: '', idPrioridad: '', problemaReportado: '', fechaEstimada: '', observaciones: '',
    },
  })
  const idCliente = useWatch({ control: form.control, name: 'idCliente' })
  const { errors, isSubmitting } = form.formState
  const clientesActivos = catalogos.clientes?.filter(cliente => cliente.estado === 'ACTIVO')
  const clienteSeleccionado = clientesActivos?.find(cliente => String(cliente.idCliente) === idCliente)
  const equiposCliente = catalogos.equipos?.filter(equipo => equipo.estado === 'ACTIVO' && equipo.idCliente === clienteSeleccionado?.idCliente)
  const catalogosDisponibles = Boolean(
    clientesActivos?.length
    && catalogos.equipos?.some(equipo => equipo.estado === 'ACTIVO' && clientesActivos.some(cliente => cliente.idCliente === equipo.idCliente))
    && catalogos.prioridades?.length
    && (!clienteSeleccionado || equiposCliente?.length),
  )
  const clienteHelp = clientesActivos === undefined
    ? 'Catálogo de clientes pendiente de conexión.'
    : clientesActivos.length ? 'Selecciona un cliente activo.' : 'El catálogo recibido no contiene clientes activos.'
  const equipoHelp = catalogos.equipos === undefined
    ? 'Catálogo de equipos pendiente de conexión.'
    : !clienteSeleccionado
      ? 'Selecciona primero un cliente activo.'
      : equiposCliente?.length
        ? 'Solo se muestran equipos activos del cliente seleccionado.'
        : 'El catálogo recibido no contiene equipos activos para este cliente.'
  const prioridadHelp = catalogos.prioridades === undefined
    ? 'Catálogo de prioridades pendiente de conexión.'
    : catalogos.prioridades.length ? 'Selecciona una prioridad.' : 'El catálogo recibido no contiene prioridades.'

  function cancel() {
    form.reset()
    setMessage('')
    onCancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="orden-form-title">Recepción de orden</CardTitle>
        <p className="text-sm text-muted-foreground">Los campos con * son obligatorios.</p>
        <p className="text-sm text-muted-foreground">Al registrarse realmente, la orden iniciará en RECIBIDO.</p>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby="orden-form-title"
          className="space-y-5"
          noValidate
          onChange={() => setMessage('')}
          onSubmit={form.handleSubmit(
            () => setMessage('Los datos del formulario son válidos. La orden aún no se ha registrado: falta conectar la API.'),
            () => setMessage(''),
          )}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <OrdenSelect
              label="Cliente"
              options={clientesActivos?.map(cliente => ({ id: cliente.idCliente, nombre: cliente.nombreMostrar }))}
              help={clienteHelp}
              registration={form.register('idCliente', { onChange: () => form.resetField('idEquipo') })}
              error={errors.idCliente}
            />
            <OrdenSelect
              label="Equipo"
              options={equiposCliente?.map(equipo => ({ id: equipo.idEquipo, nombre: `${equipo.numeroSerie} · ${equipo.modelo}` }))}
              help={equipoHelp}
              registration={form.register('idEquipo')}
              error={errors.idEquipo}
            />
            <OrdenSelect
              label="Prioridad"
              options={catalogos.prioridades?.map(prioridad => ({ id: prioridad.idPrioridad, nombre: prioridad.nombre }))}
              help={prioridadHelp}
              registration={form.register('idPrioridad')}
              error={errors.idPrioridad}
            />
            <div className="space-y-2">
              <Label htmlFor="orden-fecha-estimada">Fecha estimada</Label>
              <Input
                id="orden-fecha-estimada"
                type="date"
                aria-invalid={Boolean(errors.fechaEstimada)}
                aria-describedby={`orden-fecha-ayuda${errors.fechaEstimada ? ' orden-fecha-error' : ''}`}
                {...form.register('fechaEstimada')}
              />
              <p id="orden-fecha-ayuda" className="text-xs text-muted-foreground">
                Fecha opcional. Al registrar, se comprobará que no sea anterior al ingreso en Guatemala.
              </p>
              {errors.fechaEstimada && <p id="orden-fecha-error" role="alert" className="text-xs text-destructive">{errors.fechaEstimada.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="orden-problema">Problema reportado *</Label>
            <Textarea
              id="orden-problema"
              required
              aria-invalid={Boolean(errors.problemaReportado)}
              aria-describedby={errors.problemaReportado ? 'orden-problema-error' : undefined}
              {...form.register('problemaReportado')}
            />
            {errors.problemaReportado && <p id="orden-problema-error" role="alert" className="text-xs text-destructive">{errors.problemaReportado.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="orden-observaciones">Observaciones</Label>
            <Textarea
              id="orden-observaciones"
              aria-invalid={Boolean(errors.observaciones)}
              aria-describedby={errors.observaciones ? 'orden-observaciones-error' : undefined}
              {...form.register('observaciones')}
            />
            {errors.observaciones && <p id="orden-observaciones-error" role="alert" className="text-xs text-destructive">{errors.observaciones.message}</p>}
          </div>

          {!catalogosDisponibles && (
            <p id="orden-catalogos-pendientes" className="rounded-lg border bg-muted p-3 text-sm">
              La validación completa requiere clientes activos, sus equipos activos y prioridades disponibles en los catálogos.
            </p>
          )}
          {message && catalogosDisponibles && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{message}</p>}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={!catalogosDisponibles || isSubmitting}
              aria-describedby={!catalogosDisponibles ? 'orden-catalogos-pendientes' : undefined}
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
