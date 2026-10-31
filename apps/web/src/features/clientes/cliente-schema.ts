import { z } from 'zod'
import { validNit, phonePattern, nitMessage, phoneMessage } from '@/lib/client-validation'

// Límites de texto de dbo.Cliente en database/fases/01_tablas.sql.
// La unicidad del NIT (excepto CF) corresponde al servidor.
const commonFields = {
  nit: z.string().trim()
    .min(1, 'Escribe el NIT.')
    .max(20, 'El NIT debe tener como máximo 20 caracteres.')
    .toUpperCase().refine(validNit, nitMessage),
  telefono: z.string().trim()
    .min(1, 'Escribe el teléfono.')
    .max(20, 'El teléfono debe tener como máximo 20 caracteres.')
    .regex(phonePattern, phoneMessage),
  email: z.string().trim()
    .max(120, 'El correo debe tener como máximo 120 caracteres.')
    .refine(value => value === '' || z.email().safeParse(value).success, 'Escribe un correo válido.')
    .optional(),
  direccion: z.string().trim()
    .max(250, 'La dirección debe tener como máximo 250 caracteres.')
    .optional(),
}

// Cada variante descarta propiedades ajenas; clienteBody normaliza los nullable del DTO.
export const clienteSchema = z.discriminatedUnion('tipoCliente', [
  z.object({
    ...commonFields,
    tipoCliente: z.literal('INDIVIDUAL'),
    nombres: z.string().trim()
      .min(1, 'Escribe los nombres.')
      .max(100, 'Los nombres deben tener como máximo 100 caracteres.'),
    apellidos: z.string().trim()
      .min(1, 'Escribe los apellidos.')
      .max(100, 'Los apellidos deben tener como máximo 100 caracteres.'),
  }),
  z.object({
    ...commonFields,
    tipoCliente: z.literal('EMPRESARIAL'),
    razonSocial: z.string().trim()
      .min(1, 'Escribe la razón social.')
      .max(150, 'La razón social debe tener como máximo 150 caracteres.'),
    nombreContacto: z.string().trim()
      .max(120, 'El contacto debe tener como máximo 120 caracteres.')
      .optional(),
  }),
])

export type ClienteFormValues = z.infer<typeof clienteSchema>
