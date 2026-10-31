import { z } from 'zod'
import { requiredText } from '@/lib/draft-schema'

export const sqlInteger = (minimum: number) => z.string().trim().regex(/^\d+$/, 'Indica una cantidad entera.').refine(value => /^\d+$/.test(value) && BigInt(value) >= BigInt(minimum) && BigInt(value) <= 2147483647n, `Cantidad entre ${minimum} y 2147483647.`)
export const ajusteSchema = z.object({
  idBodega: sqlInteger(1), idRepuesto: sqlInteger(1), codigoTipoMovimiento: z.enum(['AJUSTE_ENTRADA', 'AJUSTE_SALIDA']),
  cantidad: sqlInteger(1), observacion: requiredText(300),
})
export const minimoSchema = z.object({ stockMinimo: sqlInteger(0) })
export function ajusteBody(values: z.infer<typeof ajusteSchema>) {
  return { ...values, idBodega: Number(values.idBodega), idRepuesto: Number(values.idRepuesto), cantidad: Number(values.cantidad) }
}
