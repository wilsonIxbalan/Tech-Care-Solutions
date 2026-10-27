import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { ApiError, apiFetch } from '@/lib/api-client'
import { useSession } from '@/features/auth/session-context'

const schema = z.object({
  codigo: z.string().trim().min(1, 'Escribe el código.').max(20, 'Usa hasta 20 caracteres.'),
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(80, 'Usa hasta 80 caracteres.'),
  ubicacion: z.string().trim().max(200, 'Usa hasta 200 caracteres.'),
  estado: z.enum(['ACTIVA', 'INACTIVA']),
})
type Values = z.infer<typeof schema>
interface Bodega { idBodega: number; codigo: string; nombre: string; ubicacion: string | null; estado: Values['estado'] }

function BodegaForm({ row, onClose }: { row?: Bodega; onClose: () => void }) {
  const client = useQueryClient()
  const [message, setMessage] = useState('')
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { codigo: row?.codigo ?? '', nombre: row?.nombre ?? '', ubicacion: row?.ubicacion ?? '', estado: row?.estado ?? 'ACTIVA' } })
  const save = useMutation({ retry: false, mutationFn: (values: Values) => apiFetch<Bodega>(row ? `/bodegas/${row.idBodega}` : '/bodegas', { method: row ? 'PATCH' : 'POST', body: JSON.stringify({ ...values, ubicacion: values.ubicacion || null }) }) })
  const { errors, isSubmitting } = form.formState
  return <form aria-label={row ? 'Editar bodega' : 'Crear bodega'} className="space-y-4 rounded-lg border bg-background p-4" noValidate onSubmit={form.handleSubmit(async values => {
    setMessage('')
    try {
      await save.mutateAsync(values)
      toast.success(row ? 'Bodega actualizada.' : 'Bodega creada.')
      await Promise.all(['bodegas', 'inventario', 'compras'].map(key => client.invalidateQueries({ queryKey: [key] })))
      onClose()
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'No se pudo confirmar el guardado. Consulta el listado antes de repetirlo.')
      if (error instanceof ApiError && error.details) {
        let focus = true
        for (const name of ['codigo', 'nombre', 'ubicacion', 'estado'] as const) {
          const detail = error.details[name]?.[0]
          if (detail) { form.setError(name, { message: detail }, { shouldFocus: focus }); focus = false }
        }
      }
    }
  })}>
    <fieldset disabled={isSubmitting} className="grid gap-4 sm:grid-cols-2">
      <TextField id="bodega-codigo" label="Código de bodega" required maxLength={20} autoFocus error={errors.codigo?.message} {...form.register('codigo')} />
      <TextField id="bodega-nombre" label="Nombre de bodega" required maxLength={80} error={errors.nombre?.message} {...form.register('nombre')} />
      <TextField id="bodega-ubicacion" label="Ubicación" maxLength={200} error={errors.ubicacion?.message} {...form.register('ubicacion')} />
      <SelectField id="bodega-estado" label="Estado de bodega" options={[{ value: 'ACTIVA', label: 'Activa' }, { value: 'INACTIVA', label: 'Inactiva' }]} error={errors.estado?.message} {...form.register('estado')} />
    </fieldset>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar bodega'}</Button></div>
  </form>
}

/** Mantenimiento existente de bodegas, sin alterar existencias ni movimientos. */
export function BodegasPanel() {
  const { user } = useSession()
  const allowed = user?.roles.some(role => role === 'ADMINISTRADOR' || role === 'BODEGA') ?? false
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Bodega | 'new' | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const result = useQuery({ queryKey: ['bodegas', 'gestion', search, page], enabled: allowed && open, queryFn: ({ signal }) => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (search.trim()) params.set('search', search.trim())
    return apiFetch<Bodega[]>(`/bodegas?${params}`, { signal })
  } })
  if (!allowed) return null
  return <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Administración de bodegas">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Bodegas</h2><p className="mt-1 text-sm text-muted-foreground">Organiza las ubicaciones donde se reciben y almacenan los repuestos.</p></div><Button ref={trigger} variant="outline" aria-expanded={open} aria-controls={id} onClick={() => { setOpen(!open); setEditor(null) }}>{open ? 'Cerrar bodegas' : 'Administrar bodegas'}</Button></div>
    {open && <div id={id} className="space-y-4">
      {!editor && <div className="flex flex-wrap items-end gap-3"><TextField id="bodegas-buscar" label="Buscar bodegas" maxLength={150} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /><Button onClick={() => setEditor('new')}>Nueva bodega</Button></div>}
      {editor && <BodegaForm key={editor === 'new' ? 'new' : editor.idBodega} row={editor === 'new' ? undefined : editor} onClose={() => { setEditor(null); trigger.current?.focus() }} />}
      {result.isPending ? <LoadingState label="Consultando bodegas…" /> : result.isError ? <ErrorState description={result.error.message} onRetry={() => void result.refetch()} /> : <>
        {result.data.data.length ? <ul className="divide-y rounded-lg border">{result.data.data.map(row => <li key={row.idBodega} className="flex items-center justify-between gap-4 p-3"><div><p className="font-medium">{row.codigo} · {row.nombre}</p><p className="text-sm text-muted-foreground">{row.ubicacion || 'Sin ubicación indicada'} · {row.estado === 'ACTIVA' ? 'Activa' : 'Inactiva'}</p></div><Button variant="outline" disabled={Boolean(editor)} aria-label={`Editar bodega ${row.codigo}`} onClick={() => setEditor(row)}>Editar</Button></li>)}</ul> : <EmptyState title="No hay bodegas para estos filtros" description="Crea una bodega para recibir compras y organizar las existencias." />}
        <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={page === 1 || result.isFetching || Boolean(editor)} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-sm">Página {page} de {Math.max(1, result.data.meta?.totalPages ?? 1)}</span><Button variant="outline" disabled={page >= (result.data.meta?.totalPages ?? 1) || result.isFetching || Boolean(editor)} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
      </>}
    </div>}
  </section>
}
