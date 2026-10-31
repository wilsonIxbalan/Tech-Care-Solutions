import { z } from 'zod'

// La selección se comprueba también en el esquema, no sólo en el control visual.
export function selection(values: readonly string[] | undefined, label: string) {
  return z.string().min(1, `Selecciona ${label}.`).refine(value => values?.includes(value) === true, `Selecciona ${label} del catálogo recibido.`)
}
export const requiredText = (max: number) => z.string().trim().min(1, 'Este campo es obligatorio.').max(max, `Usa como máximo ${max} caracteres.`)
export const optionalText = (max: number) => z.string().trim().max(max, `Usa como máximo ${max} caracteres.`)
export const optionalEmail = optionalText(120).refine(value => value === '' || z.email().safeParse(value).success, 'Escribe un correo válido.')

const personNamePattern = /^\p{L}[\p{L} '.-]*$/u
const personNameMessage = 'Usa solo letras, espacios, apóstrofo, punto y guion.'
/** Nombres de persona: letras (con acentos), espacios, apóstrofo, punto y guion. */
export const personName = (max: number) => requiredText(max).regex(personNamePattern, personNameMessage)
export const optionalPersonName = (max: number) => optionalText(max).refine(value => value === '' || personNamePattern.test(value), personNameMessage)
/** Códigos: letras, números, guion y guion bajo; sin espacios. */
export const codeText = (max: number, required = 'Este campo es obligatorio.') => z.string().trim().min(1, required).max(max, `Usa como máximo ${max} caracteres.`).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Usa solo letras, números, guion o guion bajo, sin espacios.')
