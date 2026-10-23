import { z } from 'zod'
import { optionalEmail, optionalText, requiredText } from '@/lib/draft-schema'

export const proveedorSchema = z.object({ nit: requiredText(20), nombre: requiredText(150), nombreContacto: optionalText(120), telefono: requiredText(20), email: optionalEmail, direccion: optionalText(250) })
// Modelo local de lectura; no presupone un endpoint.
export interface ProveedorRow { idProveedor: number; nit: string; nombre: string; nombreContacto: string | null; telefono: string; email: string | null; direccion: string | null; estado: 'ACTIVO' | 'INACTIVO' }
