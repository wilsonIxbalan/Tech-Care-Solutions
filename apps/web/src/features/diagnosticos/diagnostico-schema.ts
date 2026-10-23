import { z } from 'zod'
import { nonNegativeMoneySchema } from '@/lib/money-schema'
import { esTecnicoElegible, permiteDiagnostico } from '@/features/diagnosticos/diagnostico-catalogos'
import type { DiagnosticoCatalogos } from '@/features/diagnosticos/diagnostico-catalogos'

function catalogId(ids: readonly number[] | undefined, message: string) {
  return z.string().trim()
    .min(1, message)
    .refine(value => value === '' || ids?.some(id => String(id) === value), message)
    .transform(Number)
}

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
    costoManoObraEstimado: nonNegativeMoneySchema(
      'Escribe el costo estimado de mano de obra.',
      'El costo estimado no puede superar 9999999999.99.',
    ),
  })
}

export type DiagnosticoFormInput = z.input<ReturnType<typeof createDiagnosticoSchema>>
export type DiagnosticoFormValues = z.output<ReturnType<typeof createDiagnosticoSchema>>
