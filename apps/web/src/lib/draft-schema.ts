import { z } from 'zod'

// La selección se comprueba también en el esquema, no sólo en el control visual.
export function selection(values: readonly string[] | undefined, label: string) {
  return z.string().min(1, `Selecciona ${label}.`).refine(value => values?.includes(value) === true, `Selecciona ${label} del catálogo recibido.`)
}
export const requiredText = (max: number) => z.string().trim().min(1, 'Este campo es obligatorio.').max(max, `Usa como máximo ${max} caracteres.`)
export const optionalText = (max: number) => z.string().trim().max(max, `Usa como máximo ${max} caracteres.`)
export const optionalEmail = optionalText(120).refine(value => value === '' || z.email().safeParse(value).success, 'Escribe un correo válido.')
