import { z } from 'zod'
import { nonNegativeMoneySchema } from '@/lib/money-schema'
import { esTecnicoElegibleParaReparacion, permiteIniciarReparacion } from '@/features/reparaciones/reparacion-catalogos'
import type { ReparacionCatalogos } from '@/features/reparaciones/reparacion-catalogos'

export const reparacionInputSchema = z.object({
  descripcion: z.string().trim().min(1, 'Escribe la descripción de la reparación.').max(1000, 'La descripción debe tener como máximo 1000 caracteres.'),
  costoManoObra: nonNegativeMoneySchema('Escribe el costo de mano de obra.', 'El costo de mano de obra no puede superar 9999999999.99.'),
})
export const actividadInputSchema = z.object({
  descripcion: z.string().trim().min(1, 'Describe la actividad.').max(500, 'La descripción debe tener como máximo 500 caracteres.'),
  horasInvertidas: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, 'Indica horas positivas con hasta dos decimales.')
    .refine(value => Number(value) > 0 && Number(value) <= 999.99, 'Las horas deben ser mayores que cero y no superar 999.99.')
    .transform(value => { const [whole, decimals = ''] = value.split('.'); return `${whole.replace(/^0+(?=\d)/, '')}.${decimals.padEnd(2, '0')}` }),
})
export const finalizarInputSchema = z.object({ observacion: z.string().trim().max(500, 'La observación debe tener como máximo 500 caracteres.') })
export const cantidadConsumoSchema = z.string().trim().regex(/^[1-9]\d*$/, 'Indica una cantidad entera positiva.').refine(value => Number(value) <= 2147483647, 'Cantidad fuera de rango.').transform(Number)

function catalogId(ids: readonly number[] | undefined, message: string) {
  return z.string().trim()
    .min(1, message)
    .refine(value => value === '' || ids?.some(id => String(id) === value), message)
    .transform(Number)
}

// sp_IniciarReparacion (fase 07) y Reparacion (fase 01).
// idDiagnostico permite contrastar la selección local con la orden. El SP actual
// resuelve el diagnóstico activo por idOrden; no se presupone un payload HTTP.
export function createReparacionSchema(catalogos: ReparacionCatalogos) {
  return z.object({
    idOrden: catalogId(
      catalogos.ordenes?.filter(permiteIniciarReparacion).map(orden => orden.idOrden),
      'Selecciona una orden en espera de autorización o en reparación.',
    ),
    idDiagnostico: catalogId(
      catalogos.diagnosticos?.filter(diagnostico => diagnostico.estado === 'ACTIVO').map(diagnostico => diagnostico.idDiagnostico),
      'Selecciona un diagnóstico activo de la orden.',
    ),
    idTecnico: catalogId(
      catalogos.tecnicos?.filter(esTecnicoElegibleParaReparacion).map(tecnico => tecnico.idTecnico),
      'Selecciona un técnico elegible para reparar del catálogo disponible.',
    ),
    descripcion: z.string().trim()
      .min(1, 'Escribe la descripción de la reparación.')
      .max(1000, 'La descripción debe tener como máximo 1000 caracteres.'),
    costoManoObra: nonNegativeMoneySchema('Escribe el costo de mano de obra.', 'El costo de mano de obra no puede superar 9999999999.99.'),
  }).superRefine((values, context) => {
    const diagnostico = catalogos.diagnosticos?.find(item => item.idDiagnostico === values.idDiagnostico)
    if (diagnostico && diagnostico.idOrden !== values.idOrden) {
      context.addIssue({ code: 'custom', path: ['idDiagnostico'], message: 'El diagnóstico seleccionado no pertenece a la orden.' })
    }
  })
}

export type ReparacionFormInput = z.input<ReturnType<typeof createReparacionSchema>>
export type ReparacionFormValues = z.output<ReturnType<typeof createReparacionSchema>>
