import { z } from 'zod'
import { phoneMessage, phonePattern, validNit } from '@/lib/client-validation'
import { optionalEmail, optionalPersonName, optionalText, requiredText } from '@/lib/draft-schema'

export const proveedorSchema = z.object({ nit: requiredText(20).refine(value => value.toUpperCase() !== 'CF', 'Un proveedor necesita un NIT real; CF no aplica.').refine(value => value.toUpperCase() === 'CF' || validNit(value), 'Escribe un NIT válido con su dígito verificador (por ejemplo, 1234567-9).'), nombre: requiredText(150), nombreContacto: optionalPersonName(120), telefono: requiredText(20).regex(phonePattern, phoneMessage), email: optionalEmail, direccion: optionalText(250) })
// Contrato público del maestro de proveedores.
export interface ProveedorRow { idProveedor: number; nit: string; nombre: string; nombreContacto: string | null; telefono: string; email: string | null; direccion: string | null; estado: 'ACTIVO' | 'INACTIVO' }
