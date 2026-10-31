import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession } from '@/features/auth/session-context'
import { EquipoForm } from './equipo-form'
import { ClienteSelector } from './cliente-selector'
import type { ClienteOption } from './cliente-selector'
import { equiposReadPermissions, useEquipos } from './api'
import type { EquipoDto } from '@/types/domain'

export function EquiposPage() {
  const { user } = useSession()
  const allowed = Boolean(user?.permisos.some(permission => equiposReadPermissions.includes(permission)))
  const manage = Boolean(user?.permisos.includes('EQUIPOS_GESTIONAR'))
  const [filters, setFilters] = useState({ search: '', estado: '', page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [cliente, setCliente] = useState<ClienteOption | null>(null)
  const equipos = useEquipos({ ...filters, idCliente: cliente?.idCliente })
  const [editor, setEditor] = useState<EquipoDto | 'new' | null>(null)
  const [message, setMessage] = useState('')
  const trigger = useRef<HTMLButtonElement | null>(null)
  const newButton = useRef<HTMLButtonElement | null>(null)
  const restoreFocus = useRef(false)
  function closeEditor() { restoreFocus.current = true; setEditor(null) }
  useEffect(() => {
    if (!editor && !equipos.isFetching && restoreFocus.current) {
      (trigger.current?.isConnected ? trigger.current : newButton.current)?.focus()
      restoreFocus.current = false
    }
  }, [editor, equipos.isFetching])
  if (!allowed) return <EmptyState title="Acceso restringido" description="No tienes permiso para consultar equipos." />
  return <>
    <PageHeader eyebrow="TechCare / Recepción" title="Equipos" description="Consulta por serie o modelo y mantén los datos de cada equipo y su propietario." actions={manage && <Button ref={newButton} disabled={Boolean(editor)} onClick={event => { trigger.current = event.currentTarget; setMessage(''); setEditor('new') }}>Nuevo equipo</Button>} />
    {editor && manage && <EquipoForm key={editor === 'new' ? 'new' : editor.idEquipo} equipo={editor === 'new' ? undefined : editor} onCancel={closeEditor} onSaved={() => { closeEditor(); setMessage('Equipo guardado correctamente.') }} />}
    {message && <p role="status" className="rounded-lg border bg-accent p-3 text-sm">{message}</p>}
    <section aria-label="Listado de equipos" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem_8rem]">
        <TextField id="equipos-busqueda" label="Buscar equipos" type="search" placeholder="Número de serie o modelo" maxLength={150} value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value, page: 1 })} />
        <SelectField id="equipos-filtro-estado" label="Estado" placeholder="Todos" options={['ACTIVO', 'INACTIVO', 'BAJA'].map(value => ({ value, label: value }))} value={filters.estado} onChange={event => setFilters({ ...filters, estado: event.target.value, page: 1 })} />
        <SelectField id="equipos-tamano" label="Por página" allowEmpty={false} options={[5, 10, 20, 50].map(size => ({ value: String(size), label: String(size) }))} value={String(filters.pageSize)} onChange={event => setFilters({ ...filters, pageSize: Number(event.target.value), page: 1 })} />
      </div>
      {!editor && <ClienteSelector id="equipos-filtro-cliente" selected={cliente} onSelect={selected => { setCliente(selected); setFilters({ ...filters, page: 1 }) }} />}
      {equipos.isPending ? <LoadingState label="Consultando equipos…" /> : equipos.isError ? <ErrorState description={equipos.error.message} onRetry={() => void equipos.refetch()} /> : <>
        {equipos.data.data.length ? <div className="rounded-xl border bg-card"><Table containerLabel="Equipos"><caption className="sr-only">Equipos</caption><TableHeader><TableRow>{['Equipo', 'Número de serie', 'Propietario', 'Estado', 'Acciones'].map(title => <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader><TableBody>{equipos.data.data.map(equipo => <TableRow key={equipo.idEquipo}>
          <TableCell><p className="font-medium">{equipo.marcaNombre} {equipo.modelo}</p><p className="text-xs text-muted-foreground">{equipo.tipoEquipoNombre}</p></TableCell><TableCell className="font-mono text-xs">{equipo.numeroSerie}</TableCell><TableCell>{equipo.clienteNombre}</TableCell><TableCell><Badge variant="outline">{equipo.estado}</Badge></TableCell>
          <TableCell>{manage ? <Button variant="outline" size="sm" disabled={Boolean(editor)} aria-label={`Editar ${equipo.numeroSerie}`} onClick={event => { trigger.current = event.currentTarget; setMessage(''); setEditor(equipo) }}>Editar</Button> : <span className="text-xs text-muted-foreground">Solo consulta</span>}</TableCell>
        </TableRow>)}</TableBody></Table></div> : <EmptyState title="Sin equipos para estos filtros" description="Prueba otra serie o modelo, o cambia los filtros de estado y propietario." />}
        <div className="flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-muted-foreground">{equipos.data.meta?.total ?? equipos.data.data.length} equipos · Página {filters.page} de {Math.max(1, equipos.data.meta?.totalPages ?? 1)}</p><div className="flex gap-2"><Button variant="outline" disabled={filters.page <= 1 || equipos.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</Button><Button variant="outline" disabled={filters.page >= (equipos.data.meta?.totalPages ?? 1) || equipos.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Siguiente</Button></div></div>
      </>}
    </section>
  </>
}
