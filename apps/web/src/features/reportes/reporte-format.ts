import { formatCivilDate, formatMoney, formatUtcDateTime } from '@/lib/format'
import type { ReportRow } from './reportes-model'

const moneyColumns = new Set(['Costo', 'PrecioCostoUnitario', 'PrecioVentaUnitario', 'CostoUnitario', 'Subtotal', 'Impuesto', 'Total', 'TotalFactura', 'TotalManoObra', 'TotalRepuestos', 'TotalPagado', 'Saldo', 'SaldoPendiente', 'Monto'])
const instantColumns = new Set(['FechaIngreso', 'Fecha', 'FechaUltimoMovimiento', 'FechaCompra', 'FechaMovimiento', 'FechaFactura', 'FechaPago', 'FechaCambio', 'FechaEntrega'])

export function formatReportValue(key: string, value: ReportRow[string] | undefined): string {
  if (value === null) return '—'
  if (value === undefined) return 'Campo no recibido'
  if (moneyColumns.has(key)) return typeof value === 'string' && formatMoney(value) !== '—' ? formatMoney(value) : 'Importe no verificable'
  if (instantColumns.has(key)) return typeof value === 'string' ? formatUtcDateTime(value) : 'Fecha no verificable'
  if (key === 'FechaEstimada') return typeof value === 'string' && formatCivilDate(value) !== '—' ? formatCivilDate(value) : 'Fecha civil no verificable'
  return String(value)
}
