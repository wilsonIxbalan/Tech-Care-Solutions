import { zodResolver } from '@hookform/resolvers/zod'
import { useDraftMessage } from '@/lib/use-draft-message'
import { useForm } from 'react-hook-form'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { esTecnicoElegible, permiteDiagnostico } from '@/features/diagnosticos/diagnostico-catalogos'
import type { DiagnosticoCatalogos } from '@/features/diagnosticos/diagnostico-catalogos'
import { createDiagnosticoSchema } from '@/features/diagnosticos/diagnostico-schema'
import type { DiagnosticoFormInput, DiagnosticoFormValues } from '@/features/diagnosticos/diagnostico-schema'

function DiagnosticoSelect({ label, options, help, registration, error }: {
  label: string
  options?: readonly { id: number; nombre: string }[]
  help: string
  registration: UseFormRegisterReturn
  error?: FieldError
}) {
  const id = `diagnostico-${registration.name}`

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

export function DiagnosticoForm({ catalogos, onCancel }: { catalogos: DiagnosticoCatalogos; onCancel: () => void }) {
  const [message, setMessage] = useDraftMessage(catalogos)
  const form = useForm<DiagnosticoFormInput, unknown, DiagnosticoFormValues>({
    resolver: zodResolver(createDiagnosticoSchema(catalogos)),
    defaultValues: { idOrden: '', idTecnico: '', descripcion: '', costoManoObraEstimado: '' },
  })
  const { errors, isSubmitting } = form.formState
  const ordenesDisponibles = catalogos.ordenes?.filter(permiteDiagnostico)
  const tecnicosDisponibles = catalogos.tecnicos?.filter(esTecnicoElegible)
  const catalogosDisponibles = Boolean(ordenesDisponibles?.length && tecnicosDisponibles?.length)
  const ordenHelp = ordenesDisponibles === undefined
    ? 'Catálogo de órdenes pendiente de conexión.'
    : ordenesDisponibles.length
      ? 'Solo se muestran órdenes recibidas o en diagnóstico.'
      : 'El catálogo recibido no contiene órdenes en RECIBIDO o DIAGNOSTICO.'
  const tecnicoHelp = tecnicosDisponibles === undefined
    ? 'Catálogo de técnicos pendiente de conexión.'
    : tecnicosDisponibles.length
      ? 'Selecciona un técnico elegible según el catálogo recibido.'
      : 'El catálogo recibido no contiene técnicos elegibles.'

  function cancel() {
    form.reset()
    setMessage('')
    onCancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="diagnostico-form-title">Registrar diagnóstico</CardTitle>
        <p className="text-sm text-muted-foreground">Los campos con * son obligatorios.</p>
        <p className="text-sm text-muted-foreground">El guardado está pendiente de conectar la API.</p>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby="diagnostico-form-title"
          className="space-y-5"
          noValidate
          onChange={() => setMessage('')}
          onSubmit={form.handleSubmit(
            () => setMessage('Los datos del formulario son válidos. El diagnóstico aún no se ha guardado: falta conectar la API.'),
            () => setMessage(''),
          )}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <DiagnosticoSelect
              label="Orden"
              options={ordenesDisponibles?.map(orden => ({ id: orden.idOrden, nombre: `${orden.numeroOrden} · ${orden.estado}` }))}
              help={ordenHelp}
              registration={form.register('idOrden')}
              error={errors.idOrden}
            />
            <DiagnosticoSelect
              label="Técnico responsable"
              options={tecnicosDisponibles?.map(tecnico => ({ id: tecnico.idTecnico, nombre: tecnico.nombreCompleto }))}
              help={tecnicoHelp}
              registration={form.register('idTecnico')}
              error={errors.idTecnico}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnostico-descripcion">Descripción *</Label>
            <Textarea
              id="diagnostico-descripcion"
              required
              aria-invalid={Boolean(errors.descripcion)}
              aria-describedby={errors.descripcion ? 'diagnostico-descripcion-error' : undefined}
              {...form.register('descripcion')}
            />
            {errors.descripcion && <p id="diagnostico-descripcion-error" role="alert" className="text-xs text-destructive">{errors.descripcion.message}</p>}
          </div>

          <div className="max-w-md space-y-2">
            <Label htmlFor="diagnostico-costo">Costo estimado de mano de obra *</Label>
            <Input
              id="diagnostico-costo"
              type="text"
              inputMode="decimal"
              required
              aria-invalid={Boolean(errors.costoManoObraEstimado)}
              aria-describedby={`diagnostico-costo-ayuda${errors.costoManoObraEstimado ? ' diagnostico-costo-error' : ''}`}
              {...form.register('costoManoObraEstimado')}
            />
            <p id="diagnostico-costo-ayuda" className="text-xs text-muted-foreground">
              Se permite cero. Usa punto decimal y hasta dos decimales, sin separadores de miles.
            </p>
            {errors.costoManoObraEstimado && <p id="diagnostico-costo-error" role="alert" className="text-xs text-destructive">{errors.costoManoObraEstimado.message}</p>}
          </div>

          <p className="text-sm text-muted-foreground">
            Al registrar, el servidor comprobará que la orden no tenga otro diagnóstico activo.
          </p>
          <p className="text-sm text-muted-foreground">
            Seleccionar un técnico no autoriza la operación. El servidor comprobará la identidad y los permisos de quien la ejecute.
          </p>
          {!catalogosDisponibles && (
            <p id="diagnostico-catalogos-pendientes" className="rounded-lg border bg-muted p-3 text-sm">
              La validación completa requiere órdenes en un estado permitido y técnicos elegibles disponibles en los catálogos.
            </p>
          )}
          {message && catalogosDisponibles && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{message}</p>}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={!catalogosDisponibles || isSubmitting}
              aria-describedby={!catalogosDisponibles ? 'diagnostico-catalogos-pendientes' : undefined}
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
