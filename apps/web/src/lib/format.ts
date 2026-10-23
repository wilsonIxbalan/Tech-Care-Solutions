import type { Money } from '@/types/api'

const dateTime = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala',
})

/** Presentación exacta sobre texto, incluso para SUM(DECIMAL) mayor que Number.MAX_SAFE_INTEGER. */
export function formatMoney(value: Money): string {
  if (!/^\d+\.\d{2}$/.test(value)) return '—'
  const [integer, decimals] = value.split('.')
  return `Q ${integer.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimals}`
}

export function formatDateTime(value: string): string {
  if (!isZonedInstant(value)) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}

function isZonedInstant(value: string) {
  return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && formatCivilDate(value.slice(0, 10)) !== '—'
}

const utcDateTime = new Intl.DateTimeFormat('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })

/** No atribuye UTC a un DATETIME2 serializado sin zona ni convierte NULL en una fecha. */
export function formatUtcDateTime(value: string | null | undefined): string {
  if (value == null) return '—'
  if (!isZonedInstant(value)) return `${value || 'Fecha vacía'} (fecha o zona no verificable)`
  const instant = new Date(value)
  return Number.isNaN(instant.getTime()) ? `${value} (fecha no válida)` : `${utcDateTime.format(instant)} UTC`
}

/** A civil DATE is not a UTC timestamp. */
export function formatCivilDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '—'
  return `${match[3]}/${match[2]}/${match[1]}`
}
