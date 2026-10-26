import { describe, expect, it } from 'vitest'
import { nonNegativeMoneySchema } from '@/lib/money-schema'

const schema = nonNegativeMoneySchema('Escribe el importe.', 'El importe no puede superar 9999999999.99.')

describe('DECIMAL(12,2) no negativo como Money', () => {
  it.each([
    ['0', '0.00'], ['12', '12.00'], ['12.5', '12.50'],
    ['9999999999.99', '9999999999.99'], [' 000012.01 ', '12.01'], ['0.01', '0.01'],
    ['00000000000.00', '0.00'], ['9999999999.9', '9999999999.90'],
  ])('normaliza %j a %j sin punto flotante', (input, expected) => {
    const result = schema.parse(input)
    expect(result).toBe(expected)
    expect(typeof result).toBe('string')
  })

  it.each(['-0.01', '10000000000.00', '1.234', '1e3', '1,50', '1,000.00', 'NaN', 'Infinity'])('rechaza %j sin redondearlo ni reinterpretarlo', input => {
    expect(schema.safeParse(input).success).toBe(false)
  })
})
