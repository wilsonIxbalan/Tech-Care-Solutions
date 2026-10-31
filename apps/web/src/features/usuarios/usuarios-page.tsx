import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { invalidateRelatedQueries } from '@/lib/query-invalidation'
import { PageHeader } from '@/components/shared/page-header'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { useSession } from '@/features/auth/session-context'
import { roleCodes, roleLabels } from '@/features/auth/roles'
import { UsuarioForm } from './usuario-form'
import type { UsuarioRow } from './usuario-model'
import type { RoleCode } from '@/types/api'
import { useDebouncedValue } from '@/lib/use-debounced-value'

export function UsuariosPage() {
  const { user } = useSession()
  const [filters, setFilters] = useState({ search: '', activo: '', page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [editor, setEditor] = useState<UsuarioRow | 'new' | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const client = useQueryClient()
  const allowed = user?.roles.includes('ADMINISTRADOR') ?? false
  const search = useDebouncedValue(filters.search)
  const usuarios = useQuery({ queryKey: ['usuarios', { ...filters, search }], enabled: allowed, placeholderData: keepPreviousData, queryFn: ({ signal }) => {
    const query = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) })
    if (search.trim()) query.set('search', search.trim())
    if (filters.activo) query.set('activo', filters.activo)
    return apiFetch<UsuarioRow[]>(`/usuarios?${query}`, { signal })
  } })
  const catalogos = useQuery({ queryKey: ['catalogos'], enabled: allowed, queryFn: async ({ signal }) => (await apiFetch<{ roles: { codigo: string; nombre: string }[] }>('/catalogos', { signal })).data })
  const roles = catalogos.data?.roles.map(role => role.codigo).filter((role): role is RoleCode => roleCodes.some(code => code === role)) ?? []
  const toggle = useMutation({ mutationFn: async (usuario: UsuarioRow) => { await apiFetch<UsuarioRow>(`/usuarios/${usuario.idUsuario}`, { method: 'PATCH', body: JSON.stringify({ activo: !usuario.activo }) }); toast.success(usuario.activo ? 'Usuario desactivado.' : 'Usuario activado.'); await invalidateRelatedQueries(client, 'users'); if (usuario.idUsuario === user?.idUsuario) await client.invalidateQueries({ queryKey: ['session'] }) } })
  function closeEditor() { setEditor(null) }
  useEffect(() => { if (!editor) trigger.current?.focus() }, [editor])
  if (!allowed) return <EmptyState title="Acceso restringido" description="Solo administración puede gestionar usuarios y roles." />
  return <>
    <PageHeader title="Usuarios y roles" description="Administra el acceso y los perfiles de tu equipo." actions={<Button disabled={Boolean(editor)} onClick={event => { trigger.current = event.currentTarget; setEditor('new') }}><Plus aria-hidden="true" />Nuevo usuario</Button>} />
    {editor && <Card><CardHeader><CardTitle>{editor === 'new' ? 'Crear usuario' : `Editar a ${editor.nombreCompleto}`}</CardTitle></CardHeader><CardContent>{catalogos.isPending ? <LoadingState label="Cargando roles disponibles…" /> : catalogos.isError ? <ErrorState description="No pudimos cargar los roles." onRetry={() => void catalogos.refetch()} /> : <UsuarioForm key={editor === 'new' ? 'new' : editor.idUsuario} usuario={editor === 'new' ? undefined : editor} roles={roles} onCancel={closeEditor} onSaved={closeEditor} />}{(catalogos.isPending || catalogos.isError) && <Button className="mt-4" variant="outline" onClick={closeEditor}>Cancelar</Button>}</CardContent></Card>}
    <section aria-label="Listado de usuarios" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_8rem]">
        <TextField id="usuarios-busqueda" label="Buscar usuarios" maxLength={150} placeholder="Buscar por nombre, usuario o correo…" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value, page: 1 })} />
        <SelectField id="usuarios-estado" label="Estado" placeholder="Todos" options={[{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }]} value={filters.activo} onChange={event => setFilters({ ...filters, activo: event.target.value, page: 1 })} />
        <SelectField id="usuarios-tamano" label="Por página" allowEmpty={false} options={[5, 10, 20, 50].map(size => ({ value: String(size), label: String(size) }))} value={String(filters.pageSize)} onChange={event => setFilters({ ...filters, pageSize: Number(event.target.value), page: 1 })} />
      </div>
      {usuarios.isPending ? <LoadingState label="Consultando usuarios…" /> : usuarios.isError ? <ErrorState description={usuarios.error.message} onRetry={() => void usuarios.refetch()} /> : <>
        {usuarios.data.data.length ? <div className="rounded-xl border bg-card"><Table containerLabel="Usuarios"><caption className="sr-only">Usuarios</caption><TableHeader><TableRow>{['Usuario', 'Roles', 'Estado', 'Último acceso', 'Acciones'].map(title => <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader><TableBody>{usuarios.data.data.map(usuario => <TableRow key={usuario.idUsuario}>
          <TableCell><p className="font-medium">{usuario.nombreCompleto}</p><p className="mt-1 text-xs text-muted-foreground">{usuario.nombreUsuario} · {usuario.email}</p></TableCell>
          <TableCell><div className="flex flex-wrap gap-1">{usuario.roles.map(role => <Badge variant="outline" key={role}>{roleLabels[role]}</Badge>)}</div></TableCell>
          <TableCell><Badge variant={usuario.activo ? 'default' : 'secondary'}>{usuario.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell><TableCell className="text-xs">{usuario.ultimoAcceso ? formatDateTime(usuario.ultimoAcceso) : 'Sin accesos'}</TableCell>
          <TableCell><div className="flex gap-2"><Button variant="outline" size="sm" disabled={Boolean(editor) || toggle.isPending} aria-label={`Editar ${usuario.nombreUsuario}`} onClick={event => { trigger.current = event.currentTarget; setEditor(usuario) }}><Pencil aria-hidden="true" />Editar</Button><ConfirmDialog trigger={<Button variant="outline" size="sm" disabled={Boolean(editor) || toggle.isPending}>{usuario.activo ? 'Desactivar' : 'Activar'} {usuario.nombreUsuario}</Button>} title={`${usuario.activo ? 'Desactivar' : 'Activar'} usuario`} description={`${usuario.activo ? 'Se impedirá el acceso' : 'Se permitirá el acceso'} a ${usuario.nombreCompleto}. Sus registros se conservarán.`} confirmLabel={usuario.activo ? 'Desactivar usuario' : 'Activar usuario'} destructive={usuario.activo} onConfirm={() => toggle.mutateAsync(usuario)} /></div></TableCell>
        </TableRow>)}</TableBody></Table></div> : <EmptyState title="Sin usuarios para estos filtros" description="Prueba otra búsqueda o crea un usuario." />}
        <div className="flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-muted-foreground">{usuarios.data.meta?.total ?? usuarios.data.data.length} usuarios · Página {filters.page} de {Math.max(1, usuarios.data.meta?.totalPages ?? 1)}</p><div className="flex gap-2"><Button variant="outline" disabled={filters.page <= 1 || usuarios.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</Button><Button variant="outline" disabled={filters.page >= (usuarios.data.meta?.totalPages ?? 1) || usuarios.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Siguiente</Button></div></div>
      </>}
    </section>
  </>
}
