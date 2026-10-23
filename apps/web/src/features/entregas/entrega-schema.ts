import { z } from 'zod'
import { optionalText, requiredText, selection } from '@/lib/draft-schema'
import { moneyToMinor } from '@/lib/decimal-money'
import type { FacturaResumenDto, OrdenResumenDto } from '@/types/domain'

export type OrdenEntrega = Pick<OrdenResumenDto, 'idOrden' | 'numeroOrden' | 'estado'> & {
  // undefined: no verificado; null: la consulta confirmó que no hay factura.
  factura?: Pick<FacturaResumenDto, 'idFactura' | 'idOrden' | 'estado' | 'saldo'> | null
}
export function entregaRequirements(orden?: OrdenEntrega) {
  const factura = orden?.factura
  return [
    { label: 'Orden LISTO', status: !orden ? 'Pendiente de verificar' : orden.estado === 'LISTO' ? 'Coincide con los datos recibidos' : 'Estado no permitido' },
    { label: 'Factura vigente de la orden', status: factura === undefined ? 'Pendiente de verificar' : factura === null ? 'Falta factura' : factura.estado === 'ANULADA' || factura.idOrden !== orden?.idOrden ? 'Factura no válida para esta orden' : 'Coincide con los datos recibidos' },
    { label: 'Saldo exactamente cero', status: !factura || moneyToMinor(factura.saldo) === null ? 'Pendiente de verificar' : moneyToMinor(factura.saldo) === 0n ? 'Coincide con los datos recibidos' : 'Tiene saldo pendiente' },
  ]
}
export function permiteBorradorEntrega(orden: OrdenEntrega) {
  return entregaRequirements(orden).every(item => item.status === 'Coincide con los datos recibidos')
}
export function createEntregaSchema(ordenes?: readonly OrdenEntrega[]) {
  return z.object({
    idOrden: selection(ordenes?.filter(permiteBorradorEntrega).map(o => String(o.idOrden)), 'una orden con estado, factura y saldo verificables'),
    nombreRecibe: requiredText(150), documentoRecibe: optionalText(30), observaciones: optionalText(500),
  })
}
