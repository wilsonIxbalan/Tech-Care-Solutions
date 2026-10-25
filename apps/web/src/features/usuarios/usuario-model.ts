import { z } from 'zod'
import { optionalText, requiredText, selection } from '@/lib/draft-schema'

// Proyecciones explícitas para la UI. Nunca incluyen PasswordHash ni credenciales.
export interface UsuarioRow { idUsuario: number; nombreUsuario: string; nombreCompleto: string; email: string; telefono: string | null; activo: boolean; fechaCreacion: string; ultimoAcceso: string | null }
export interface RolRow { idRol: number; codigo: string; nombre: string; descripcion: string | null; activo: boolean; permisos?: readonly { codigo: string; descripcion: string }[] }
export interface AsignacionRow { idUsuario: number; idRol: number; fechaAsignacion: string }
export const usuarioSchema = z.object({ nombreUsuario: requiredText(50), nombreCompleto: requiredText(150), email: requiredText(120).pipe(z.email('Escribe un correo válido.')), telefono: optionalText(20), activo: z.enum(['1', '0']) })
export function createAsignacionSchema(usuarios?: readonly UsuarioRow[], roles?: readonly RolRow[], asignaciones?: readonly AsignacionRow[]) {
  return z.object({ idUsuario: selection(usuarios?.map(u => String(u.idUsuario)), 'un usuario'), idRol: selection(roles?.map(r => String(r.idRol)), 'un rol') }).superRefine((value, ctx) => {
    if (asignaciones === undefined) ctx.addIssue({ code: 'custom', path: ['idRol'], message: 'Falta recibir las asignaciones existentes para revisar duplicados.' })
    else if (asignaciones.some(a => String(a.idUsuario) === value.idUsuario && String(a.idRol) === value.idRol)) ctx.addIssue({ code: 'custom', path: ['idRol'], message: 'El usuario ya tiene asignado ese rol.' })
  })
}
