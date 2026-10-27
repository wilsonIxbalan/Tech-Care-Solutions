import { z } from 'zod'
import { formatCivilDate } from '@/lib/format'
import type { ReportCatalogos, ReportDefinition } from './reportes-model'

export function createReportSchema(report: ReportDefinition, catalogos: ReportCatalogos) {
  const shape: Record<string, z.ZodString> = {}
  for (const filter of report.filters) shape[filter.key] = z.string().trim().superRefine((value, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (!value) { if (filter.required || filter.kind === 'boolean') invalid('Este filtro es obligatorio.'); return }
    if (filter.catalog && catalogos[filter.catalog] && !catalogos[filter.catalog]?.some(option => option.value === value)) invalid('Selecciona una opción del catálogo recibido.')
    if (filter.key.startsWith('Id') && (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647)) invalid('Indica un identificador entero positivo válido.')
    if (filter.catalog && !filter.key.startsWith('Id') && value.length > 30) invalid('Usa como máximo 30 caracteres.')
    if (filter.kind === 'date' && formatCivilDate(value) === '—') invalid('Indica una fecha válida (AAAA-MM-DD).')
    if (filter.kind === 'serie' && value.length > 60) invalid('Usa como máximo 60 caracteres.')
    if (filter.kind === 'boolean' && value !== '0' && value !== '1') invalid('Selecciona Sí o No.')
  })
  return z.object(shape).superRefine((value, ctx) => {
    if (value.Desde && value.HastaExclusiva && value.Desde > value.HastaExclusiva) ctx.addIssue({ code: 'custom', path: ['HastaExclusiva'], message: 'Hasta debe ser igual o posterior a Desde.' })
    if (value.HastaExclusiva === '9999-12-31') ctx.addIssue({ code: 'custom', path: ['HastaExclusiva'], message: 'La fecha final debe ser anterior a 9999-12-31.' })
  })
}
