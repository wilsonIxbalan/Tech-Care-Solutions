import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DraftSection } from '@/components/shared/draft-section'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import type { ReceivedData } from '@/lib/received-data'
import { formatUtcDateTime } from '@/lib/format'
import { UsuarioForm } from './usuario-form'
import { AsignacionForm } from './asignacion-form'
import type { AsignacionRow, RolRow, UsuarioRow } from './usuario-model'

export function UsuariosPage({ usuarios = { status: 'pending' }, roles = { status: 'pending' }, asignaciones = { status: 'pending' } }: { usuarios?: ReceivedData<UsuarioRow>; roles?: ReceivedData<RolRow>; asignaciones?: ReceivedData<AsignacionRow> }) {
  const [search, setSearch] = useState('')
  const [activo, setActivo] = useState('')
  const users = usuarios.status === 'success' ? usuarios.data : undefined
  const roleData = roles.status === 'success' ? roles.data : undefined
  const assignments = asignaciones.status === 'success' ? asignaciones.data : undefined
  const filtered = usuarios.status === 'success' ? { ...usuarios, data: usuarios.data.filter(u => (!activo || u.activo === (activo === '1')) && `${u.nombreUsuario} ${u.nombreCompleto} ${u.email}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) } : usuarios
  return <><PageHeader title="Usuarios y roles" description="Preparación de perfiles, consulta de roles y asignaciones. Autenticación y autorización reales pendientes de integrar." />
    <p className="rounded-lg border p-4 text-sm">El frontend no acredita permisos: ocultar botones no constituye autorización. El servidor deberá identificar al ejecutor y aplicar USUARIOS_GESTIONAR. Los roles del motor SQL son distintos de los roles de la aplicación.</p>
    <DraftSection title="Perfiles de usuario" action="Preparar perfil de usuario">{cancel => <UsuarioForm onCancel={cancel} />}</DraftSection>
    <DraftSection title="Asignaciones de roles" action="Preparar asignación de rol">{cancel => <AsignacionForm usuarios={users} roles={roleData} asignaciones={assignments} onCancel={cancel} />}</DraftSection>
    <section aria-label="Usuarios recibidos" className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
      <TextField id="usuarios-busqueda" label="Filtrar usuarios recibidos" value={search} onChange={e => setSearch(e.target.value)} />
      <SelectField id="usuarios-estado" label="Filtrar por estado" placeholder="Todos" options={[{ value: '1', label: 'Activo' }, { value: '0', label: 'Inactivo' }]} value={activo} onChange={e => setActivo(e.target.value)} />
    </div><ReceivedTable state={filtered} caption="Usuarios" rowKey={u => u.idUsuario} columns={[
      { title: 'Usuario', cell: u => u.nombreUsuario }, { title: 'Nombre', cell: u => u.nombreCompleto }, { title: 'Correo', cell: u => u.email }, { title: 'Teléfono', cell: u => u.telefono }, { title: 'Estado', cell: u => u.activo ? 'Activo' : 'Inactivo' }, { title: 'Creación (UTC)', cell: u => formatUtcDateTime(u.fechaCreacion) }, { title: 'Último acceso (UTC)', cell: u => formatUtcDateTime(u.ultimoAcceso) },
    ]} /></section>
    <section aria-label="Roles y permisos recibidos" className="space-y-3"><h2 className="text-lg font-semibold">Roles y permisos recibidos</h2><ReceivedTable state={roles} caption="Roles" rowKey={r => r.idRol} columns={[
      { title: 'Código', cell: r => r.codigo }, { title: 'Rol', cell: r => r.nombre }, { title: 'Descripción', cell: r => r.descripcion }, { title: 'Estado', cell: r => r.activo ? 'Activo' : 'Inactivo' }, { title: 'Permisos recibidos', cell: r => r.permisos === undefined ? 'Pendiente de datos' : r.permisos.length ? r.permisos.map(p => `${p.codigo}: ${p.descripcion}`).join('; ') : 'Sin permisos asignados según datos recibidos' },
    ]} /></section>
    <ReceivedTable state={asignaciones} caption="Asignaciones de roles" rowKey={a => `${a.idUsuario}-${a.idRol}`} columns={[
      { title: 'Usuario', cell: a => users?.find(u => u.idUsuario === a.idUsuario)?.nombreUsuario ?? `ID recibido: ${a.idUsuario}` }, { title: 'Rol', cell: a => roleData?.find(r => r.idRol === a.idRol)?.nombre ?? `ID recibido: ${a.idRol}` }, { title: 'Asignación (UTC)', cell: a => formatUtcDateTime(a.fechaAsignacion) },
    ]} />
  </>
}
