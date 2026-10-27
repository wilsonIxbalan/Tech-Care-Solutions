import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { TextField, SelectField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession } from '@/features/auth/session-context'
import { ClienteForm } from './cliente-form'
import { clientesReadPermissions, useClientes } from './api'
import type { ClienteDto } from '@/types/domain'

export function ClientesPage() {
  const { user } = useSession()
  const allowed = Boolean(user?.permisos.some(permission => clientesReadPermissions.includes(permission)))
  const manage = Boolean(user?.permisos.includes('CLIENTES_GESTIONAR'))
  const [filters, setFilters] = useState({ search: '', estado: '', page: 1, pageSize: 20 })
  const clientes = useClientes(filters)
  const [editor, setEditor] = useState<ClienteDto | 'new' | null>(null)
  const [message, setMessage] = useState('')
  const trigger = useRef<HTMLButtonElement | null>(null)
  const newButton = useRef<HTMLButtonElement | null>(null)
  const restoreFocus = useRef(false)
  function closeEditor() { restoreFocus.current = true; setEditor(null) }
  useEffect(() => {
    if (!editor && !clientes.isFetching && restoreFocus.current) {
      (trigger.current?.isConnected ? trigger.current : newButton.current)?.focus()
      restoreFocus.current = false
    }
  }, [editor, clientes.isFetching])
  if (!allowed) return <EmptyState title="Acceso restringido" description="No tienes permiso para consultar clientes." />
  return <>
    <PageHeader eyebrow="TechCare / Recepción" title="Clientes" description="Datos de contacto y facturación de clientes individuales y empresariales." actions={manage && <Button ref={newButton} disabled={Boolean(editor)} onClick={event => { trigger.current = event.currentTarget; setMessage(''); setEditor('new') }}>Nuevo cliente</Button>} />
    {editor && manage && <ClienteForm key={editor === 'new' ? 'new' : editor.idCliente} cliente={editor === 'new' ? undefined : editor} onCancel={closeEditor} onSaved={() => { closeEditor(); setMessage('Cliente guardado correctamente.') }} />}
    {message && <p role="status" className="rounded-lg border bg-accent p-3 text-sm">{message}</p>}
    <section aria-label="Listado de clientes" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem_8rem]">
        <TextField id="clientes-busqueda" label="Buscar clientes" type="search" placeholder="Nombre, NIT o teléfono" maxLength={150} value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value, page: 1 })} />
        <SelectField id="clientes-filtro-estado" label="Estado" placeholder="Todos" options={[{ value: 'ACTIVO', label: 'Activo' }, { value: 'INACTIVO', label: 'Inactivo' }]} value={filters.estado} onChange={event => setFilters({ ...filters, estado: event.target.value, page: 1 })} />
        <SelectField id="clientes-tamano" label="Por página" options={[10, 20, 50].map(size => ({ value: String(size), label: String(size) }))} value={String(filters.pageSize)} onChange={event => setFilters({ ...filters, pageSize: Number(event.target.value), page: 1 })} />
      </div>
      {clientes.isPending ? <LoadingState label="Consultando clientes…" /> : clientes.isError ? <ErrorState description={clientes.error.message} onRetry={() => void clientes.refetch()} /> : <>
        {clientes.data.data.length ? <div className="rounded-xl border bg-card"><Table containerLabel="Clientes"><TableHeader><TableRow>{['Cliente', 'NIT', 'Contacto', 'Estado', 'Acciones'].map(title => <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader><TableBody>{clientes.data.data.map(cliente => <TableRow key={cliente.idCliente}>
          <TableCell><p className="font-medium">{cliente.nombreMostrar}</p><p className="text-xs text-muted-foreground">{cliente.tipoCliente === 'INDIVIDUAL' ? 'Individual' : 'Empresarial'}</p></TableCell>
          <TableCell>{cliente.nit}</TableCell><TableCell><p>{cliente.telefono}</p><p className="text-xs text-muted-foreground">{cliente.email ?? 'Sin correo'}</p></TableCell><TableCell><Badge variant="outline">{cliente.estado}</Badge></TableCell>
          <TableCell>{manage ? <Button variant="outline" size="sm" disabled={Boolean(editor)} aria-label={`Editar ${cliente.nombreMostrar}`} onClick={event => { trigger.current = event.currentTarget; setMessage(''); setEditor(cliente) }}>Editar</Button> : <span className="text-xs text-muted-foreground">Solo consulta</span>}</TableCell>
        </TableRow>)}</TableBody></Table></div> : <EmptyState title="Sin clientes para estos filtros" description="Prueba otro nombre, NIT o teléfono, o cambia el estado seleccionado." />}
        <div className="flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-muted-foreground">{clientes.data.meta?.total ?? clientes.data.data.length} clientes · Página {filters.page} de {Math.max(1, clientes.data.meta?.totalPages ?? 1)}</p><div className="flex gap-2"><Button variant="outline" disabled={filters.page <= 1 || clientes.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</Button><Button variant="outline" disabled={filters.page >= (clientes.data.meta?.totalPages ?? 1) || clientes.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Siguiente</Button></div></div>
      </>}
    </section>
  </>
}
