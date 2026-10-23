import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UsuariosPage } from './usuarios-page'
import { createAsignacionSchema, usuarioSchema } from './usuario-model'
import type { RolRow, UsuarioRow } from './usuario-model'

const usuarios: UsuarioRow[] = [1, 2].map(idUsuario => ({ idUsuario, nombreUsuario: `prueba${idUsuario}`, nombreCompleto: `Usuario de prueba ${idUsuario}`, email: `prueba${idUsuario}@example.com`, telefono: null, activo: idUsuario === 1, fechaCreacion: '2026-10-22T12:00:00Z', ultimoAcceso: null }))
const roles: RolRow[] = [{ idRol: 3, codigo: 'TECNICO', nombre: 'Técnico de prueba', descripcion: null, activo: true }]
describe('usuarios y roles preparados', () => {
  it('valida sólo el perfil y descarta campos ajenos; no deduce políticas de contraseña', () => {
    const valid = { nombreUsuario: 'prueba', nombreCompleto: 'Nombre de prueba', email: 'prueba@example.com', telefono: '', activo: '1' }
    expect(usuarioSchema.parse({ ...valid, password: 'campo ajeno' })).not.toHaveProperty('password')
    for (const patch of [{ nombreUsuario: '  ' }, { nombreCompleto: ' ' }, { nombreUsuario: 'x'.repeat(51) }, { email: 'inválido' }, { telefono: 'x'.repeat(21) }]) expect(usuarioSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
  it('rechaza pares duplicados, catálogos ausentes e IDs ajenos sin inventar restricciones sobre usuario inactivo', () => {
    const valid = { idUsuario: '1', idRol: '3' }
    expect(createAsignacionSchema(usuarios, roles, []).safeParse(valid).success).toBe(true)
    expect(createAsignacionSchema(usuarios, roles, []).safeParse({ ...valid, idUsuario: '2' }).success).toBe(true)
    expect(createAsignacionSchema(usuarios, roles, [{ idUsuario: 1, idRol: 3, fechaAsignacion: '2026-10-22T12:00:00Z' }]).safeParse(valid).success).toBe(false)
    expect(createAsignacionSchema(usuarios, roles).safeParse(valid).success).toBe(false)
    expect(createAsignacionSchema().safeParse(valid).success).toBe(false)
    expect(createAsignacionSchema(usuarios, roles, []).safeParse({ ...valid, idRol: '99' }).success).toBe(false)
  })
  it('mantiene perfil disponible y bloquea asignación completa sin catálogos', () => {
    render(<UsuariosPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Preparar perfil de usuario' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preparar asignación de rol' }))
    expect(within(screen.getByRole('form', { name: 'Borrador de perfil de usuario' })).getByRole('button', { name: 'Validar datos' })).toBeEnabled()
    expect(within(screen.getByRole('form', { name: 'Borrador de asignación de rol' })).getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    expect(document.querySelector('input[type=password]')).toBeNull()
  })
  it('cambia de usuario limpiando el rol, valida sin red ni persistencia y cancela limpiando', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<UsuariosPage usuarios={{ status: 'success', data: usuarios }} roles={{ status: 'success', data: roles }} asignaciones={{ status: 'success', data: [] }} />)
    const trigger = screen.getByRole('button', { name: 'Preparar asignación de rol' })
    fireEvent.click(trigger)
    fireEvent.change(screen.getByLabelText('Usuario *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Rol *'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Usuario *'), { target: { value: '2' } })
    expect(screen.getByLabelText('Rol *')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Rol *'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Todavía no se ha asignado el rol')
    expect(fetchSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    expect(screen.getByLabelText('Usuario *')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
