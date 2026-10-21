import type { Money } from '@/types/api'

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const dateTime = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala',
})

/** Presentation only. Financial calculations belong to SQL. */
export function formatMoney(value: Money): string {
  if (!/^\d+\.\d{2}$/.test(value)) return '—'
  const number = Number(value)
  return Number.isFinite(number) ? currency.format(number) : '—'
}

export function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}

/** A civil DATE is not a UTC timestamp. */
export function formatCivilDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '—'
  return `${match[3]}/${match[2]}/${match[1]}`
}
