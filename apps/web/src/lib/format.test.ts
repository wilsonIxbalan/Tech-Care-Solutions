import { describe, expect, it } from 'vitest'
import { formatCivilDate, formatDateTime, formatMoney } from '@/lib/format'

describe('presentation formats', () => {
  it('formats GTQ without accepting formatted user input as Money', () => {
    expect(formatMoney('1250.50')).toMatch(/1,250\.50/)
    expect(formatMoney('Q 1,250.50')).toBe('—')
    expect(formatMoney('')).toBe('—')
  })
  it('does not move a civil DATE to the previous day', () => {
    expect(formatCivilDate('2026-10-31')).toBe('31/10/2026')
    expect(formatCivilDate('invalid')).toBe('—')
    expect(formatCivilDate('2026-02-31')).toBe('—')
  })
  it('rejects malformed timestamps', () => {
    expect(formatDateTime('not-a-date')).toBe('—')
    expect(formatDateTime('2026-10-31T18:00:00Z')).toContain('2026')
  })
})
