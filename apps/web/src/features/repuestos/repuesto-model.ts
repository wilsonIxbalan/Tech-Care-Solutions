import { z } from 'zod'
import { codeText, optionalText, requiredText, selection } from '@/lib/draft-schema'
import { moneyToMinor } from '@/lib/decimal-money'
import { nonNegativeMoneySchema } from '@/lib/money-schema'

// Contratos públicos del maestro de repuestos y opciones de categoría.
export interface CategoriaOption { idCategoria: number; nombre: string }
export interface RepuestoRow { idRepuesto: number; idCategoria: number; codigo: string; nombre: string; descripcion: string | null; precioCompraReferencia: string; precioVenta: string; estado: 'ACTIVO' | 'INACTIVO' }
export function createRepuestoSchema(categorias?: readonly CategoriaOption[]) {
  return z.object({
    idCategoria: selection(categorias?.map(item => String(item.idCategoria)), 'una categoría'),
    codigo: codeText(30), nombre: requiredText(120), descripcion: optionalText(300),
    precioCompraReferencia: nonNegativeMoneySchema('Indica el precio de referencia.', 'Máximo 9999999999.99.'),
    precioVenta: nonNegativeMoneySchema('Indica el precio de venta.', 'Máximo 9999999999.99.'),
  }).superRefine((value, ctx) => {
    const compra = moneyToMinor(value.precioCompraReferencia)
    const venta = moneyToMinor(value.precioVenta)
    if (compra !== null && venta !== null && venta < compra) ctx.addIssue({ code: 'custom', path: ['precioVenta'], message: 'El precio de venta no puede ser menor que el precio de compra de referencia.' })
  })
}
