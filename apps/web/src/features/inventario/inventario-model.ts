import type { InventarioDto, MovimientoDto } from '@/types/domain'
import { formatGuatemalaDateTime } from '@/lib/format'

export interface BodegaOption { idBodega: number; nombre: string; estado: 'ACTIVA' | 'INACTIVA' }
export interface TipoMovimientoOption { codigo: string; nombre: string; naturaleza: 'E' | 'S' }
export function stockLabel(row: Pick<InventarioDto, 'existencia' | 'stockMinimo'>) {
  return row.existencia === 0 ? 'Sin stock' : row.existencia <= row.stockMinimo ? 'Igual o inferior al mínimo' : 'Sobre el mínimo'
}
export const inventoryColumns = [
  { title: 'Bodega', cell: (r: InventarioDto) => r.bodegaNombre }, { title: 'Categoría', cell: (r: InventarioDto) => r.categoriaNombre },
  { title: 'Código', cell: (r: InventarioDto) => r.codigoRepuesto }, { title: 'Repuesto', cell: (r: InventarioDto) => r.repuestoNombre },
  { title: 'Existencia', cell: (r: InventarioDto) => r.existencia }, { title: 'Mínimo', cell: (r: InventarioDto) => r.stockMinimo },
  { title: 'Situación', cell: stockLabel }, { title: 'Último movimiento (Guatemala)', cell: (r: InventarioDto) => formatGuatemalaDateTime(r.fechaUltimoMovimiento) },
]
export const movementColumns = [
  { title: 'Fecha (Guatemala)', cell: (r: MovimientoDto) => formatGuatemalaDateTime(r.fechaMovimiento) }, { title: 'Bodega', cell: (r: MovimientoDto) => r.bodegaNombre },
  { title: 'Código', cell: (r: MovimientoDto) => r.codigoRepuesto }, { title: 'Repuesto', cell: (r: MovimientoDto) => r.repuestoNombre },
  { title: 'Tipo', cell: (r: MovimientoDto) => r.codigoTipoMovimiento }, { title: 'Naturaleza', cell: (r: MovimientoDto) => r.naturaleza },
  { title: 'Cantidad', cell: (r: MovimientoDto) => r.cantidad }, { title: 'Existencia resultante', cell: (r: MovimientoDto) => r.existenciaResultante },
  { title: 'Origen', cell: (r: MovimientoDto) => `${r.documentoOrigen} · ${r.numeroDocumento}` }, { title: 'Usuario', cell: (r: MovimientoDto) => r.usuarioNombre },
  { title: 'Observación', cell: (r: MovimientoDto) => r.observacion },
]
