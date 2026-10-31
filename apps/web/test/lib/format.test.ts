import { describe, expect, it } from 'vitest'
import { formatCivilDate, formatDateTime, formatMoney, formatGuatemalaDateTime } from '@/lib/format'

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
    expect(formatGuatemalaDateTime(null)).toBe('—')
    expect(formatGuatemalaDateTime('2026-10-31T18:00:00')).toContain('zona no verificable')
    expect(formatGuatemalaDateTime('2026-02-30T18:00:00Z')).toContain('no verificable')
    expect(formatGuatemalaDateTime('2026-10-31T18:00:00-06:00')).toMatch(/31\/10\/2026.*18:00:00.*Guatemala/)
    expect(formatGuatemalaDateTime('2026-11-01T03:00:00Z')).toMatch(/31\/10\/2026.*21:00:00.*Guatemala/)
  })
})
