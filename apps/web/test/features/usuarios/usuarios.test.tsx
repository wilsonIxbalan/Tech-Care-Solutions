import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UsuariosPage } from '@/features/usuarios/usuarios-page'
import { createAsignacionSchema, createUsuarioSchema, usuarioPayload } from '@/features/usuarios/usuario-model'
import type { RolRow, UsuarioRow } from '@/features/usuarios/usuario-model'
import { adminUser, json, renderWithSession } from '../../support/session'

const usuarios: UsuarioRow[] = [1, 2].map(idUsuario => ({ idUsuario, nombreUsuario: `prueba${idUsuario}`, nombreCompleto: `Usuario de prueba ${idUsuario}`, email: `prueba${idUsuario}@example.com`, telefono: null, activo: idUsuario === 1, roles: ['TECNICO'], fechaCreacion: '2026-10-22T12:00:00Z', ultimoAcceso: null }))
const roles: RolRow[] = [{ idRol: 3, codigo: 'TECNICO', nombre: 'Técnico', descripcion: null, activo: true }]
const valid = { nombreUsuario: 'prueba', nombreCompleto: 'Nombre de prueba', email: 'prueba@example.com', telefono: '', activo: '1', password: ' clave segura ', roles: ['TECNICO'] }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/catalogos')) return json({ data: { roles: [{ codigo: 'TECNICO', nombre: 'Técnico' }, { codigo: 'CAJA', nombre: 'Caja' }] } })
    if (options?.method === 'POST' || options?.method === 'PATCH') return json({ data: { ...usuarios[0], ...JSON.parse(String(options.body)) } })
    if (url.includes('/usuarios?')) return json({ data: usuarios, meta: { page: 1, pageSize: 20, total: 41, totalPages: 3 } })
    throw new Error(`Consulta inesperada: ${url}`)
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('administración de usuarios', () => {
  it('valida perfil, correo, máximos, roles únicos y política de password sin recortar secretos', () => {
    const schema = createUsuarioSchema()
    expect(schema.parse({ ...valid, passwordHash: 'no exponer' })).not.toHaveProperty('passwordHash')
    expect(schema.parse(valid).password).toBe(' clave segura ')
    for (const patch of [{ nombreUsuario: '  ' }, { nombreCompleto: ' ' }, { nombreUsuario: 'x'.repeat(51) }, { nombreCompleto: 'x'.repeat(151) }, { nombreUsuario: 'a@b' }, { email: 'inválido' }, { email: 'x'.repeat(121) }, { telefono: 'x'.repeat(21) }, { password: '' }, { password: 'x'.repeat(11) }, { password: 'x'.repeat(129) }, { roles: [] }, { roles: ['ANALISTA'] }, { roles: ['CAJA', 'CAJA'] }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
    expect(createUsuarioSchema(true).safeParse({ ...valid, password: '' }).success).toBe(true)
    expect(createUsuarioSchema(true).safeParse({ ...valid, password: ' ' }).success).toBe(false)
    expect(usuarioPayload(schema.parse(valid))).toMatchObject({ activo: true, telefono: null, password: ' clave segura ', roles: ['TECNICO'] })
    expect(usuarioPayload(createUsuarioSchema(true).parse({ ...valid, password: '' }))).not.toHaveProperty('password')
  })
  it('conserva validación anterior de asignaciones duplicadas e IDs fuera de catálogo', () => {
    const assignment = { idUsuario: '1', idRol: '3' }
    expect(createAsignacionSchema(usuarios, roles, []).safeParse(assignment).success).toBe(true)
    expect(createAsignacionSchema(usuarios, roles, []).safeParse({ ...assignment, idUsuario: '2' }).success).toBe(true)
    expect(createAsignacionSchema(usuarios, roles, [{ idUsuario: 1, idRol: 3, fechaAsignacion: '2026-10-22T12:00:00Z' }]).safeParse(assignment).success).toBe(false)
    expect(createAsignacionSchema(usuarios, roles).safeParse(assignment).success).toBe(false)
    expect(createAsignacionSchema().safeParse(assignment).success).toBe(false)
    expect(createAsignacionSchema(usuarios, roles, []).safeParse({ ...assignment, idRol: '99' }).success).toBe(false)
  })
  it('impide consultas de usuarios sin rol ADMINISTRADOR', () => {
    renderWithSession(<UsuariosPage />, { user: { ...adminUser, roles: ['CAJA'] } })
    expect(screen.getByText('Acceso restringido')).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('consulta lista con búsqueda, filtros y paginación en servidor', async () => {
    renderWithSession(<UsuariosPage />)
    expect(await screen.findByText('Usuario de prueba 1')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.anything()))
    fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'prueba' } })
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('page=1&pageSize=5&search=prueba'), expect.anything()))
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'false' } })
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('activo=false'), expect.anything()))
    fireEvent.change(screen.getByLabelText('Por página'), { target: { value: '10' } })
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('pageSize=10'), expect.anything()))
  })
  it('crea con password y roles reales; éxito solo tras respuesta, limpia y devuelve foco', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    renderWithSession(<UsuariosPage />)
    const trigger = screen.getByRole('button', { name: 'Nuevo usuario' })
    fireEvent.click(trigger)
    await screen.findByRole('form', { name: 'Crear usuario' })
    fireEvent.change(screen.getByLabelText('Nombre de usuario *'), { target: { value: 'nuevo' } })
    fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: 'Nuevo usuario' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico *'), { target: { value: 'nuevo@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña inicial *'), { target: { value: ' clave segura ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Técnico' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/usuarios', expect.objectContaining({ method: 'POST', credentials: 'include', body: JSON.stringify({ nombreUsuario: 'nuevo', nombreCompleto: 'Nuevo usuario', email: 'nuevo@example.com', telefono: null, activo: true, roles: ['TECNICO'], password: ' clave segura ' }) })))
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument())
    expect(storage).not.toHaveBeenCalled()
    await waitFor(() => expect(trigger).toHaveFocus())
    fireEvent.click(trigger)
    expect(await screen.findByLabelText('Contraseña inicial *')).toHaveValue('')
  })
  it('exige contraseña y rol al crear y conserva el foco de validación', async () => {
    renderWithSession(<UsuariosPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Crear usuario' }))
    expect(await screen.findByText('La contraseña debe tener entre 12 y 128 caracteres.')).toBeVisible()
    expect(screen.getByText('Selecciona al menos un rol.')).toBeVisible()
    await waitFor(() => expect(screen.getByLabelText('Nombre de usuario *')).toHaveFocus())
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })
  it('edita perfil y roles omitiendo password vacío, permite cambiarla explícitamente', async () => {
    renderWithSession(<UsuariosPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar prueba2' }))
    expect(screen.getByLabelText('Nombre completo *')).toHaveValue('Usuario de prueba 2')
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Caja' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url, options]) => url === '/api/v1/usuarios/2' && options?.method === 'PATCH' && !JSON.parse(String(options.body)).password && JSON.parse(String(options.body)).roles.includes('CAJA'))).toBe(true))
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Editar prueba2' }))
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nueva clave segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url, options]) => url === '/api/v1/usuarios/2' && JSON.parse(String(options?.body ?? '{}')).password === 'nueva clave segura')).toBe(true))
  })
  it('aplica errores de validación o conflicto sin perder el formulario ni fingir guardado', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (url, options) => options?.method === 'PATCH' ? json({ error: { code: 'DUPLICADO', message: 'El correo ya está en uso.', details: { email: ['Usa otro correo.'] } }, requestId: 'test' }, 409) : original(url, options))
    renderWithSession(<UsuariosPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar prueba2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('El correo ya está en uso.')).toBeVisible()
    expect(screen.getByLabelText('Correo electrónico *')).toHaveValue('prueba2@example.com')
    expect(screen.getByLabelText('Correo electrónico *')).toHaveAccessibleDescription('Máximo 120 caracteres. Usa otro correo.')
    expect(screen.getByRole('form', { name: 'Editar usuario' })).toBeVisible()
  })
  it('confirma desactivación, envía solo activo y permite cancelar sin red', async () => {
    renderWithSession(<UsuariosPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar prueba1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar prueba1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar usuario' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/usuarios/1', expect.objectContaining({ method: 'PATCH', body: '{"activo":false}' })))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
