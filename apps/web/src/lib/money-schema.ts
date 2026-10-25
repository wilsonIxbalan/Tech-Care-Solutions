import { z } from 'zod'
import type { Money } from '@/types/api'

const decimalPattern = /^\d+(?:\.\d{1,2})?$/

function integerPart(value: string) {
  return value.split('.')[0].replace(/^0+(?=\d)/, '')
}

// Diagnostico.CostoManoObraEstimado y Reparacion.CostoManoObra:
// DECIMAL(12,2) >= 0. Solo opera sobre texto, sin floats ni redondeos.
export function nonNegativeMoneySchema(requiredMessage: string, limitMessage: string) {
  return z.string().trim()
    .min(1, requiredMessage)
    .regex(decimalPattern, 'Escribe un importe no negativo con punto decimal y hasta dos decimales.')
    .refine(value => !decimalPattern.test(value) || integerPart(value).length <= 10, limitMessage)
    .transform((value): Money => {
      const decimals = value.split('.')[1] ?? ''
      return `${integerPart(value)}.${decimals.padEnd(2, '0')}`
    })
}
