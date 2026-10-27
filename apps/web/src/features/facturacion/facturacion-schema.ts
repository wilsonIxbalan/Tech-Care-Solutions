import { z } from 'zod'
import { optionalText, requiredText, selection } from '@/lib/draft-schema'
import { nonNegativeMoneySchema } from '@/lib/money-schema'
import { moneyToMinor } from '@/lib/decimal-money'
import type { FacturaResumenDto, OrdenResumenDto } from '@/types/domain'

export type OrdenFacturacion = Pick<OrdenResumenDto, 'idOrden' | 'numeroOrden' | 'estado'>
export interface MetodoPagoOption { idMetodoPago: number; nombre: string; activo: boolean }
const inheritedText = (max: number) => optionalText(max).transform(value => value || null)
export const porcentajeImpuestoSchema = nonNegativeMoneySchema('Indica el porcentaje de impuesto.', 'El porcentaje debe estar entre 0 y 100.')
  .refine(value => { const minor = moneyToMinor(value); return minor !== null && minor <= 10000n }, 'El porcentaje debe estar entre 0 y 100.')
export function createFacturacionSchema(ordenes?: readonly OrdenFacturacion[]) {
  return z.object({
    idOrden: selection(ordenes?.filter(o => o.estado === 'LISTO').map(o => String(o.idOrden)), 'una orden LISTO'),
    nitFacturacion: inheritedText(20), nombreFacturacion: inheritedText(150), direccionFacturacion: inheritedText(250),
    porcentajeImpuesto: porcentajeImpuestoSchema.default('12.00'),
  })
}
export const anularPagoSchema = z.object({ motivo: requiredText(300) })
export function admiteBorradorPago(factura: FacturaResumenDto) {
  const saldo = moneyToMinor(factura.saldo)
  return factura.estado === 'EMITIDA' && saldo !== null && saldo > 0n
}
export function createPagoSchema(facturas?: readonly FacturaResumenDto[], metodos?: readonly MetodoPagoOption[]) {
  return z.object({
    idFactura: selection(facturas?.filter(admiteBorradorPago).map(f => String(f.idFactura)), 'una factura emitida con saldo verificable'),
    idMetodoPago: selection(metodos?.filter(m => m.activo).map(m => String(m.idMetodoPago)), 'un método activo'),
    monto: nonNegativeMoneySchema('Indica el monto.', 'Máximo 9999999999.99.').refine(value => moneyToMinor(value) !== 0n, 'El monto debe ser mayor que cero.'),
    referencia: optionalText(60),
  }).superRefine((value, ctx) => {
    const factura = facturas?.find(f => String(f.idFactura) === value.idFactura)
    const saldo = factura ? moneyToMinor(factura.saldo) : null
    const monto = moneyToMinor(value.monto)
    if (saldo !== null && monto !== null && monto > saldo) ctx.addIssue({ code: 'custom', path: ['monto'], message: 'El monto supera el saldo recibido. El servidor debe verificar el saldo vigente.' })
  })
}
