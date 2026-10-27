import { describe, expect, it } from 'vitest'
import { formatCivilDate, formatDateTime, formatMoney, formatUtcDateTime } from '@/lib/format'

describe('presentation formats', () => {
  it('formats GTQ without accepting formatted user input as Money', () => {
    expect(formatMoney('1250.50')).toMatch(/1,250\.50/)
    expect(formatMoney('Q 1,250.50')).toBe('—')
    expect(formatMoney('')).toBe('—')
    expect(formatMoney('99999999999999999999999999.99')).toBe('Q 99,999,999,999,999,999,999,999,999.99')
  })
  it('does not move a civil DATE to the previous day', () => {
    expect(formatCivilDate('2026-10-31')).toBe('31/10/2026')
    expect(formatCivilDate('invalid')).toBe('—')
    expect(formatCivilDate('2026-02-31')).toBe('—')
  })
  it('rejects malformed timestamps', () => {
    expect(formatDateTime('not-a-date')).toBe('—')
    expect(formatDateTime('2026-10-31T18:00:00Z')).toContain('2026')
    expect(formatDateTime('2026-10-31T18:00:00')).toBe('—')
  })
  it('preserva nulos y distingue instantes explícitos de fechas sin zona o inválidas', () => {
    expect(formatUtcDateTime(null)).toBe('—')
    expect(formatUtcDateTime('2026-10-31T18:00:00')).toContain('zona no verificable')
    expect(formatUtcDateTime('2026-02-30T18:00:00Z')).toContain('no verificable')
    expect(formatUtcDateTime('2026-10-31T18:00:00-06:00')).toMatch(/01\/11\/2026.*00:00:00.*UTC/)
  })
})
