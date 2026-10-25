import { zodResolver } from '@hookform/resolvers/zod'
import { useDraftMessage } from '@/lib/use-draft-message'
import { useForm, useWatch } from 'react-hook-form'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { esTecnicoElegibleParaReparacion, permiteIniciarReparacion } from '@/features/reparaciones/reparacion-catalogos'
import type { ReparacionCatalogos } from '@/features/reparaciones/reparacion-catalogos'
import { createReparacionSchema } from '@/features/reparaciones/reparacion-schema'
import type { ReparacionFormInput, ReparacionFormValues } from '@/features/reparaciones/reparacion-schema'

function ReparacionSelect({ label, options, help, registration, error }: {
  label: string
  options?: readonly { id: number; nombre: string }[]
  help: string
  registration: UseFormRegisterReturn
  error?: FieldError
}) {
  const id = `reparacion-${registration.name}`
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label} *</Label>
      <NativeSelect
        {...registration}
        id={id}
        className="min-w-0"
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

export function ReparacionForm({ catalogos, onCancel }: { catalogos: ReparacionCatalogos; onCancel: () => void }) {
  const [message, setMessage] = useDraftMessage(catalogos)
  const form = useForm<ReparacionFormInput, unknown, ReparacionFormValues>({
    resolver: zodResolver(createReparacionSchema(catalogos)),
    defaultValues: { idOrden: '', idDiagnostico: '', idTecnico: '', descripcion: '', costoManoObra: '' },
  })
  const idOrden = useWatch({ control: form.control, name: 'idOrden' })
  const { errors, isSubmitting } = form.formState
  const ordenesDisponibles = catalogos.ordenes?.filter(permiteIniciarReparacion)
  const ordenSeleccionada = ordenesDisponibles?.find(orden => String(orden.idOrden) === idOrden)
  const diagnosticosOrden = catalogos.diagnosticos?.filter(diagnostico => diagnostico.estado === 'ACTIVO' && diagnostico.idOrden === ordenSeleccionada?.idOrden)
  const tecnicosDisponibles = catalogos.tecnicos?.filter(esTecnicoElegibleParaReparacion)
  const catalogosDisponibles = Boolean(
    ordenesDisponibles?.length && tecnicosDisponibles?.length
    && catalogos.diagnosticos?.some(diagnostico => diagnostico.estado === 'ACTIVO' && ordenesDisponibles.some(orden => orden.idOrden === diagnostico.idOrden))
    && (!ordenSeleccionada || diagnosticosOrden?.length),
  )
  const ordenHelp = ordenesDisponibles === undefined
    ? 'Catálogo de órdenes pendiente de conexión.'
    : ordenesDisponibles.length ? 'Solo se muestran órdenes en espera de autorización o en reparación.' : 'El catálogo recibido no contiene órdenes en estados permitidos para iniciar una reparación.'
  const diagnosticoHelp = catalogos.diagnosticos === undefined
    ? 'Catálogo de diagnósticos pendiente de conexión.'
    : !ordenSeleccionada
      ? 'Selecciona primero una orden.'
      : diagnosticosOrden?.length
        ? 'Solo se muestran diagnósticos activos de la orden seleccionada.'
        : 'El catálogo recibido no contiene un diagnóstico activo para esta orden.'
  const tecnicoHelp = tecnicosDisponibles === undefined
    ? 'Catálogo de técnicos pendiente de conexión.'
    : tecnicosDisponibles.length ? 'Selecciona un técnico elegible para reparar según el catálogo.' : 'El catálogo recibido no contiene técnicos elegibles para reparar.'

  function cancel() {
    form.reset()
    setMessage('')
    onCancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="reparacion-form-title">Preparar inicio de reparación</CardTitle>
        <p className="text-sm text-muted-foreground">Los campos con * son obligatorios.</p>
        <p className="text-sm text-muted-foreground">Al registrarse realmente, la reparación iniciará en EN_PROCESO.</p>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby="reparacion-form-title"
          className="space-y-5"
          noValidate
          onChange={() => setMessage('')}
          onSubmit={form.handleSubmit(
            () => setMessage('Los datos del formulario son válidos. La reparación aún no se ha guardado ni iniciado: falta conectar la API.'),
            () => setMessage(''),
          )}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <ReparacionSelect
              label="Orden"
              options={ordenesDisponibles?.map(orden => ({ id: orden.idOrden, nombre: `${orden.numeroOrden} · ${orden.estado}` }))}
              help={ordenHelp}
              registration={form.register('idOrden', { onChange: () => form.resetField('idDiagnostico') })}
              error={errors.idOrden}
            />
            <ReparacionSelect
              label="Diagnóstico previo"
              options={diagnosticosOrden?.map(diagnostico => ({ id: diagnostico.idDiagnostico, nombre: diagnostico.descripcion }))}
              help={diagnosticoHelp}
              registration={form.register('idDiagnostico')}
              error={errors.idDiagnostico}
            />
            <ReparacionSelect
              label="Técnico responsable"
              options={tecnicosDisponibles?.map(tecnico => ({ id: tecnico.idTecnico, nombre: tecnico.nombreCompleto }))}
              help={tecnicoHelp}
              registration={form.register('idTecnico')}
              error={errors.idTecnico}
            />
            <div className="min-w-0 space-y-2">
              <Label htmlFor="reparacion-costo">Costo de mano de obra *</Label>
              <Input
                id="reparacion-costo"
                type="text"
                inputMode="decimal"
                required
                aria-invalid={Boolean(errors.costoManoObra)}
                aria-describedby={`reparacion-costo-ayuda${errors.costoManoObra ? ' reparacion-costo-error' : ''}`}
                {...form.register('costoManoObra')}
              />
              <p id="reparacion-costo-ayuda" className="text-xs text-muted-foreground">Se permite cero. Usa punto decimal y hasta dos decimales, sin separadores de miles.</p>
              {errors.costoManoObra && <p id="reparacion-costo-error" role="alert" className="text-xs text-destructive">{errors.costoManoObra.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reparacion-descripcion">Descripción de la reparación *</Label>
            <Textarea
              id="reparacion-descripcion"
              required
              aria-invalid={Boolean(errors.descripcion)}
              aria-describedby={errors.descripcion ? 'reparacion-descripcion-error' : undefined}
              {...form.register('descripcion')}
            />
            {errors.descripcion && <p id="reparacion-descripcion-error" role="alert" className="text-xs text-destructive">{errors.descripcion.message}</p>}
          </div>

          <p className="text-sm text-muted-foreground">El servidor comprobará que la orden no esté facturada y que el diagnóstico siga activo.</p>
          <p className="text-sm text-muted-foreground">Seleccionar un técnico elegible no autoriza la operación. El servidor verificará la identidad y los permisos de quien la ejecute.</p>
          {!catalogosDisponibles && <p id="reparacion-catalogos-pendientes" className="rounded-lg border bg-muted p-3 text-sm">La validación completa requiere una orden en estado permitido, su diagnóstico activo y técnicos elegibles recibidos.</p>}
          {message && catalogosDisponibles && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{message}</p>}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!catalogosDisponibles || isSubmitting} aria-describedby={!catalogosDisponibles ? 'reparacion-catalogos-pendientes' : undefined}>Validar datos</Button>
            <Button type="button" variant="outline" onClick={cancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
