import { z } from 'zod'
import type { Money } from '@/types/api'
import { esTecnicoElegible, permiteDiagnostico } from '@/features/diagnosticos/diagnostico-catalogos'
import type { DiagnosticoCatalogos } from '@/features/diagnosticos/diagnostico-catalogos'

function catalogId(ids: readonly number[] | undefined, message: string) {
  return z.string().trim()
    .min(1, message)
    .refine(value => value === '' || ids?.some(id => String(id) === value), message)
    .transform(Number)
}

const decimalPattern = /^\d+(?:\.\d{1,2})?$/

function integerPart(value: string) {
  return value.split('.')[0].replace(/^0+(?=\d)/, '')
}

// DECIMAL(12,2), costo >= 0 (fase 01). No se convierten importes a Number
// ni se redondean. Se completan dos decimales, como espera formatMoney.
const costoEstimadoSchema = z.string().trim()
  .min(1, 'Escribe el costo estimado de mano de obra.')
  .regex(decimalPattern, 'Escribe un importe no negativo con punto decimal y hasta dos decimales.')
  .refine(value => !decimalPattern.test(value) || integerPart(value).length <= 10, 'El costo estimado no puede superar 9999999999.99.')
  .transform((value): Money => {
    const decimals = value.split('.')[1] ?? ''
    return `${integerPart(value)}.${decimals.padEnd(2, '0')}`
  })

// Reglas de sp_RegistrarDiagnostico (fase 07); no es un contrato de creación.
// La unicidad del diagnóstico activo y la autorización deben repetirse en el servidor.
export function createDiagnosticoSchema(catalogos: DiagnosticoCatalogos) {
  return z.object({
    idOrden: catalogId(
      catalogos.ordenes?.filter(permiteDiagnostico).map(orden => orden.idOrden),
      'Selecciona una orden recibida o en diagnóstico del catálogo disponible.',
    ),
    idTecnico: catalogId(
      catalogos.tecnicos?.filter(esTecnicoElegible).map(tecnico => tecnico.idTecnico),
      'Selecciona un técnico elegible del catálogo disponible.',
    ),
    descripcion: z.string().trim()
      .min(1, 'Escribe la descripción del diagnóstico.')
      .max(1000, 'La descripción debe tener como máximo 1000 caracteres.'),
    costoManoObraEstimado: costoEstimadoSchema,
  })
}

export type DiagnosticoFormInput = z.input<ReturnType<typeof createDiagnosticoSchema>>
export type DiagnosticoFormValues = z.output<ReturnType<typeof createDiagnosticoSchema>>
