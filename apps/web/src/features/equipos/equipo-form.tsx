import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { AreaField, TextField } from '@/components/shared/form-fields'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label, RequiredMark } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { EquipoCatalogos } from '@/features/equipos/equipo-catalogos'
import { createEquipoSchema } from '@/features/equipos/equipo-schema'
import type { EquipoFormInput, EquipoFormValues } from '@/features/equipos/equipo-schema'
import { useSession } from '@/features/auth/session-context'
import { clientesReadPermissions } from '@/features/clientes/api'
import { SaveError } from '@/features/clientes/save-error'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { ClienteSelector } from './cliente-selector'
import type { ClienteOption } from './cliente-selector'
import { equipoBody, useEquipoCatalogos, useSaveEquipo } from './api'
import type { EquipoDto } from '@/types/domain'

function CatalogSelect({ label, catalogName, options, registration, error, value }: {
  label: string
  catalogName: string
  options?: readonly { id: number; nombre: string }[]
  registration: UseFormRegisterReturn
  error?: FieldError
  value: string
}) {
  const id = `equipo-${registration.name}`
  const available = Boolean(options?.length)
  const help = options === undefined
    ? `Cargando ${catalogName}.`
    : available
      ? 'Selecciona una opción del catálogo recibido.'
      : `El catálogo recibido de ${catalogName} no contiene opciones.`

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} <RequiredMark /></Label>
      <NativeSelect
        {...registration}
        value={value}
        id={id}
        required
        disabled={!available}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      >
        <option value="">{available ? 'Selecciona una opción' : options === undefined ? 'Cargando opciones' : 'Catálogo sin opciones'}</option>
        {options?.map(option => <option key={option.id} value={option.id}>{option.nombre}</option>)}
      </NativeSelect>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error.message}</p>}
    </div>
  )
}

export function EquipoForm({ equipo, onCancel, onSaved }: { equipo?: EquipoDto; onCancel: () => void; onSaved: () => void }) {
  const { user } = useSession()
  const allowed = Boolean(user?.permisos.includes('EQUIPOS_GESTIONAR'))
  const canReadClientes = Boolean(user?.permisos.some(permission => clientesReadPermissions.includes(permission)))
  const catalogs = useEquipoCatalogos(allowed)
  const [selected, setSelected] = useState<ClienteOption | null>(equipo ? { idCliente: equipo.idCliente, nombreMostrar: equipo.clienteNombre } : null)
  const [estado, setEstado] = useState<EquipoDto['estado']>(equipo?.estado ?? 'ACTIVO')
  const catalogos: EquipoCatalogos = { ...catalogs.data, clientes: selected ? [selected] : [] }
  const save = useSaveEquipo(equipo?.idEquipo)
  const sending = useRef(false)
  const form = useForm<EquipoFormInput, unknown, EquipoFormValues>({
    resolver: zodResolver(createEquipoSchema(catalogos)),
    defaultValues: equipo ? {
      idCliente: String(equipo.idCliente), idTipoEquipo: String(equipo.idTipoEquipo), idMarca: String(equipo.idMarca),
      modelo: equipo.modelo, numeroSerie: equipo.numeroSerie, descripcion: equipo.descripcion ?? '',
    } : {
      idCliente: '',
      idTipoEquipo: '',
      idMarca: '',
      modelo: '',
      numeroSerie: '',
      descripcion: '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const idTipoEquipo = useWatch({ control: form.control, name: 'idTipoEquipo' })
  const idMarca = useWatch({ control: form.control, name: 'idMarca' })
  const catalogosDisponibles = Boolean(catalogos.tiposEquipo?.length && catalogos.marcas?.length)

  function cancel() {
    form.reset()
    onCancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="equipo-form-title">{equipo ? 'Editar equipo' : 'Registrar equipo'}</CardTitle>
        <p className="text-sm text-muted-foreground">Los campos con * son obligatorios.</p>
        <p className="text-sm text-muted-foreground">Identifica el equipo por su serie. El propietario solo puede cambiar si no tiene órdenes registradas.</p>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby="equipo-form-title"
          className="space-y-5"
          noValidate
          onSubmit={async event => {
            event.preventDefault()
            if (!allowed || !catalogosDisponibles || sending.current || (!canReadClientes && !equipo)) return
            sending.current = true
            try {
              await form.handleSubmit(async values => {
                try { await save.mutateAsync(equipoBody(values, estado)); onSaved() } catch { /* Preserve form and ownership conflicts. */ }
              })(event)
            }
            finally { sending.current = false }
          }}
        >
          <fieldset disabled={!allowed || isSubmitting} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <ClienteSelector selected={selected} onSelect={setSelected} disabled={!allowed || isSubmitting}
              registration={form.register('idCliente')}
              error={errors.idCliente}
            />
            <CatalogSelect
              label="Tipo de equipo"
              value={idTipoEquipo}
              catalogName="tipos de equipo"
              options={catalogos.tiposEquipo?.map(tipo => ({ id: tipo.idTipoEquipo, nombre: tipo.nombre }))}
              registration={form.register('idTipoEquipo')}
              error={errors.idTipoEquipo}
            />
            <CatalogSelect
              label="Marca"
              value={idMarca}
              catalogName="marcas"
              options={catalogos.marcas?.map(marca => ({ id: marca.idMarca, nombre: marca.nombre }))}
              registration={form.register('idMarca')}
              error={errors.idMarca}
            />
            <TextField id="equipo-modelo" placeholder="ThinkPad T14" autoComplete="off" label="Modelo" autoFocus required maxLength={80} error={errors.modelo?.message} {...form.register('modelo')} />
            <TextField id="equipo-numero-serie" placeholder="SN-ABC123" autoComplete="off" autoCapitalize="characters" label="Número de serie" required maxLength={60} error={errors.numeroSerie?.message} {...form.register('numeroSerie')} />
          </div>

          <AreaField id="equipo-descripcion" placeholder="Color, accesorios y estado físico del equipo" label="Descripción" required maxLength={300} error={errors.descripcion?.message} {...form.register('descripcion')} />

          <div className="space-y-2"><Label htmlFor="equipo-estado">Estado del equipo</Label><NativeSelect id="equipo-estado" value={estado} onChange={event => setEstado(event.target.value as EquipoDto['estado'])}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option><option value="BAJA">Baja</option></NativeSelect></div>
          </fieldset>
          {catalogs.isPending && <LoadingState label="Cargando tipos de equipo y marcas…" />}
          {catalogs.isError && <ErrorState description={catalogs.error.message} onRetry={() => void catalogs.refetch()} />}
          {!catalogosDisponibles && (
            <p id="equipo-catalogos-pendientes" className="rounded-lg border bg-muted p-3 text-sm">
              Para guardar necesitas tipos de equipo y marcas disponibles. Si no hay opciones, solicita su registro a administración.
            </p>
          )}
          <SaveError error={save.error} />
          {!allowed && <p role="alert">No tienes permiso para gestionar equipos.</p>}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={!allowed || !catalogosDisponibles || isSubmitting || (!canReadClientes && !equipo)}
              aria-describedby={!catalogosDisponibles ? 'equipo-catalogos-pendientes' : undefined}
            >
              {isSubmitting ? 'Guardando…' : 'Guardar equipo'}
            </Button>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={cancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
