import { z } from 'zod'
import { formatCivilDate, isZonedInstant } from '@/lib/format'

export const optionalCivilDate = z.string().refine(value => value === '' || formatCivilDate(value) !== '—', 'Indica una fecha válida (AAAA-MM-DD).')
export const dateRangeSchema = z.object({ desde: optionalCivilDate, hastaExclusiva: optionalCivilDate }).superRefine((value, ctx) => {
  if (value.desde && value.hastaExclusiva && value.desde >= value.hastaExclusiva) ctx.addIssue({ code: 'custom', path: ['hastaExclusiva'], message: 'El límite exclusivo debe ser posterior a Desde.' })
})

/** Sólo instantes con zona explícita. No interpreta DATETIME2 sin zona como hora del navegador. */
export function guatemalaCivilDay(instant: string): string | null {
  if (!isZonedInstant(instant)) return null
  const date = new Date(instant)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}
export function inCivilRange(instant: string, desde: string, hastaExclusiva: string) {
  if (!desde && !hastaExclusiva) return true
  const day = guatemalaCivilDay(instant)
  return day !== null && (!desde || day >= desde) && (!hastaExclusiva || day < hastaExclusiva)
}
