import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AreaField, SelectField, TextField } from '@/components/shared/form-fields'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { ApiError } from '@/lib/api-client'
import { guatemalaCivilDay } from '@/lib/civil-date'
import type { ClienteDto, EquipoDto } from '@/types/domain'
import type { OrdenCatalogos } from './orden-catalogos'
import { createOrdenSchema, type OrdenFormInput, type OrdenFormValues } from './orden-schema'
import { canService, useServiceCatalogos, useServiceMutation } from './api'
import { ApiSelector } from './api-selector'
import { ServiceError } from './service-form'

export function OrdenForm({ onCancel, onCreated }: { catalogos?: OrdenCatalogos; onCancel: () => void; onCreated?: (id: number) => void }) {
  const { user } = useSession()
  const [cliente, setCliente] = useState<ClienteDto | null>(null)
  const [equipo, setEquipo] = useState<EquipoDto | null>(null)
  const catalogos = useServiceCatalogos()
  const mutation = useServiceMutation<{ idOrden: number; numeroOrden: string; estado: string }>('/ordenes')
  const lock = useRef(false)
  const [created, setCreated] = useState<string | null>(null)
  const form = useForm<OrdenFormInput, unknown, OrdenFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createOrdenSchema({ clientes: cliente ? [cliente] : [], equipos: equipo ? [equipo] : [], prioridades: catalogos.data?.data.prioridades.map(p => ({ idPrioridad: p.id, nombre: p.nombre })) ?? [] })),
    defaultValues: { idCliente: '', idEquipo: '', idPrioridad: '', problemaReportado: '', fechaEstimada: '', observaciones: '' },
  })
  const { errors } = form.formState
  async function submit(values: OrdenFormValues) {
    if (lock.current || !canService(user, 'ORDENES_CREAR')) return
    lock.current = true
    try {
      const result = await mutation.mutateAsync({ ...values, fechaEstimada: values.fechaEstimada || null, observaciones: values.observaciones || null })
      setCreated(`${result.data.numeroOrden} · ${result.data.estado}`)
      onCreated?.(result.data.idOrden)
    } catch (error) {
      if (error instanceof ApiError) Object.entries(error.details ?? {}).forEach(([key, messages]) => {
        if (key in form.getValues()) form.setError(key as keyof OrdenFormInput, { type: 'server', message: messages.join(' ') })
      })
    } finally { lock.current = false }
  }
  if (created) return <div role="status" className="rounded-xl border p-4">Orden registrada: {created}. <Button variant="outline" onClick={onCancel}>Cerrar</Button></div>
  return <form aria-label="Recepción de orden" noValidate className="space-y-4 rounded-xl border p-4" onSubmit={event => { void form.handleSubmit(submit)(event) }}>
    <h2 className="text-lg font-semibold">Recepción de orden</h2>
    <fieldset disabled={mutation.isPending} className="space-y-4">
      <ApiSelector<ClienteDto> searchable path="/clientes" label="Cliente" filters={{ estado: 'ACTIVO' }} selected={cliente} valueOf={c => c.idCliente} labelOf={c => c.nombreMostrar} error={errors.idCliente?.message} onSelect={value => {
        setCliente(value); setEquipo(null); form.setValue('idCliente', value ? String(value.idCliente) : '', { shouldValidate: true }); form.setValue('idEquipo', '')
      }} />
      <ApiSelector<EquipoDto> searchable key={cliente?.idCliente ?? 'sin-cliente'} path="/equipos" label="Equipo" filters={{ estado: 'ACTIVO', idCliente: cliente?.idCliente }} selected={equipo} disabled={!cliente} valueOf={e => e.idEquipo} labelOf={e => `${e.numeroSerie} · ${e.modelo}`} error={errors.idEquipo?.message} onSelect={value => { setEquipo(value); form.setValue('idEquipo', value ? String(value.idEquipo) : '', { shouldValidate: true }) }} />
      {catalogos.isPending ? <LoadingState label="Cargando prioridades…" /> : catalogos.isError ? <ErrorState description={catalogos.error.message} onRetry={() => void catalogos.refetch()} /> : <SelectField id="orden-prioridad" label="Prioridad" required options={catalogos.data.data.prioridades.map(p => ({ value: String(p.id), label: p.nombre }))} error={errors.idPrioridad?.message} {...form.register('idPrioridad')} />}
      <TextField id="orden-fecha" label="Fecha estimada" type="date" min={guatemalaCivilDay(new Date().toISOString())!} error={errors.fechaEstimada?.message} help="Fecha de entrega prevista. Selecciona hoy o una fecha posterior, según la hora de Guatemala." {...form.register('fechaEstimada')} />
      <AreaField id="orden-problema" label="Problema reportado" required maxLength={1000} error={errors.problemaReportado?.message} {...form.register('problemaReportado')} />
      <AreaField id="orden-observaciones" label="Observaciones" maxLength={500} error={errors.observaciones?.message} {...form.register('observaciones')} />
    </fieldset>
    <ServiceError error={mutation.error} />
    <div className="flex gap-2"><Button type="submit" disabled={mutation.isPending || !catalogos.data || !canService(user, 'ORDENES_CREAR')}>{mutation.isPending ? 'Registrando…' : 'Registrar orden'}</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onCancel}>Cancelar</Button></div>
  </form>
}
