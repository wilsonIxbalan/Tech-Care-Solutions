import { z } from 'zod'
import { optionalText, selection } from '@/lib/draft-schema'
import { nonNegativeMoneySchema } from '@/lib/money-schema'
import { minorToMoney, moneyToMinor } from '@/lib/decimal-money'
import type { ProveedorRow } from '@/features/proveedores/proveedor-schema'
import type { BodegaOption } from '@/features/inventario/inventario-model'
import type { RepuestoRow } from '@/features/repuestos/repuesto-model'

export interface CompraCatalogos { proveedores?: readonly ProveedorRow[]; bodegas?: readonly BodegaOption[]; repuestos?: readonly RepuestoRow[] }
const cost = nonNegativeMoneySchema('Indica el costo unitario.', 'Máximo 9999999999.99.')
const quantity = z.string().trim().regex(/^\d+$/, 'Indica una cantidad entera positiva.').refine(value => /^\d+$/.test(value) && BigInt(value) > 0n && BigInt(value) <= 2147483647n, 'Cantidad entre 1 y 2147483647.')
export function createCompraSchema(catalogos: CompraCatalogos, remote = false) {
  const remoteId = z.string().regex(/^[1-9]\d*$/, 'Selecciona una opción.').refine(value => Number(value) <= 2147483647, 'ID fuera de rango.')
  const line = z.object({
    idRepuesto: remote ? remoteId : selection(catalogos.repuestos?.filter(r => r.estado === 'ACTIVO').map(r => String(r.idRepuesto)), 'un repuesto activo'),
    cantidad: quantity, costoUnitario: cost,
  }).superRefine((value, ctx) => {
    const cents = moneyToMinor(value.costoUnitario)
    if (cents !== null && /^\d+$/.test(value.cantidad) && BigInt(value.cantidad) * cents > 99999999999999n) ctx.addIssue({ code: 'custom', path: ['cantidad'], message: 'El subtotal de la línea no puede superar 999999999999.99.' })
  })
  return z.object({
    idProveedor: remote ? remoteId : selection(catalogos.proveedores?.filter(p => p.estado === 'ACTIVO').map(p => String(p.idProveedor)), 'un proveedor activo'),
    idBodegaDestino: remote ? remoteId : selection(catalogos.bodegas?.filter(b => b.estado === 'ACTIVA').map(b => String(b.idBodega)), 'una bodega activa'),
    numeroDocumentoProveedor: optionalText(40), observaciones: optionalText(500), items: z.array(line).min(1, 'Agrega al menos un repuesto.').max(500, 'Máximo 500 líneas.'),
  }).superRefine((value, ctx) => {
    const seen = new Set<string>()
    value.items.forEach((item, i) => {
      if (seen.has(item.idRepuesto)) ctx.addIssue({ code: 'custom', path: ['items', i, 'idRepuesto'], message: 'El repuesto ya está incluido. Ajusta su única línea; SQL no permite repetirlo.' })
      seen.add(item.idRepuesto)
    })
  })
}

export function estimatePurchase(items: readonly { cantidad: string; costoUnitario: string }[]): string | null {
  if (!items.length) return null
  let total = 0n
  for (const item of items) {
    const qty = quantity.safeParse(item.cantidad)
    const parsed = cost.safeParse(item.costoUnitario)
    if (!qty.success || !parsed.success) return null
    const subtotal = BigInt(qty.data) * moneyToMinor(parsed.data)!
    if (subtotal > 99999999999999n) return null
    total += subtotal
  }
  return minorToMoney(total)
}

export function compraBody(values: z.output<ReturnType<typeof createCompraSchema>>) {
  return { idProveedor: Number(values.idProveedor), idBodegaDestino: Number(values.idBodegaDestino),
    numeroDocumentoProveedor: values.numeroDocumentoProveedor || null, observaciones: values.observaciones || null,
    items: values.items.map(item => ({ idRepuesto: Number(item.idRepuesto), cantidad: Number(item.cantidad), costoUnitario: item.costoUnitario })) }
}
