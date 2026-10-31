import { z } from 'zod'
import { guatemalaCivilDay } from '@/lib/civil-date'
import type { OrdenCatalogos } from '@/features/ordenes/orden-catalogos'

function catalogId(ids: readonly number[] | undefined, message: string) {
  return z.string().trim()
    .min(1, message)
    .refine(value => value === '' || ids?.some(id => String(id) === value), message)
    .transform(Number)
}

// Cliente/equipo activos: sp_RegistrarOrdenServicio (fase 07, errores 50200/50201)
// y trg_OrdenServicio_Ingreso (fase 08, error 52051). No es una regla nueva.
// Reglas de OrdenServicio y recepción; no es un contrato HTTP.
export function createOrdenSchema(catalogos: OrdenCatalogos) {
  return z.object({
    idCliente: catalogId(
      catalogos.clientes?.filter(cliente => cliente.estado === 'ACTIVO').map(cliente => cliente.idCliente),
      'Selecciona un cliente activo del catálogo disponible.',
    ),
    idEquipo: catalogId(
      catalogos.equipos?.filter(equipo => equipo.estado === 'ACTIVO').map(equipo => equipo.idEquipo),
      'Selecciona un equipo activo del cliente.',
    ),
    idPrioridad: catalogId(catalogos.prioridades?.map(prioridad => prioridad.idPrioridad), 'Selecciona una prioridad del catálogo disponible.'),
    problemaReportado: z.string().trim()
      .min(1, 'Escribe el problema reportado.')
      .max(1000, 'El problema reportado debe tener como máximo 1000 caracteres.'),
    // Fecha civil AAAA-MM-DD; el mínimo se comprueba contra el día de Guatemala.
    fechaEstimada: z.string().trim()
      .refine(value => value === '' || (!value.startsWith('0000-') && z.iso.date().safeParse(value).success), 'Escribe una fecha válida (AAAA-MM-DD).'),
    observaciones: z.string().trim()
      .max(500, 'Las observaciones deben tener como máximo 500 caracteres.'),
  }).superRefine((values, context) => {
    const today = guatemalaCivilDay(new Date().toISOString())!
    if (values.fechaEstimada && values.fechaEstimada < today) {
      context.addIssue({ code: 'custom', path: ['fechaEstimada'], message: `No puedes agendar la entrega para ${values.fechaEstimada}: es anterior a hoy (${today}, hora de Guatemala). Selecciona hoy o una fecha posterior.` })
    }
    const equipo = catalogos.equipos?.find(item => item.idEquipo === values.idEquipo)
    if (equipo && equipo.idCliente !== values.idCliente) {
      context.addIssue({ code: 'custom', path: ['idEquipo'], message: 'El equipo seleccionado no pertenece al cliente.' })
    }
  })
}

export type OrdenFormInput = z.input<ReturnType<typeof createOrdenSchema>>
export type OrdenFormValues = z.output<ReturnType<typeof createOrdenSchema>>
