import { formatCivilDate, formatMoney, formatGuatemalaDateTime } from '@/lib/format'
import type { ReportRow } from './reportes-model'
import { reportPublicKey } from './reportes-model'

const moneyColumns = new Set(['Costo', 'PrecioCostoUnitario', 'PrecioVentaUnitario', 'CostoUnitario', 'PrecioUnitario', 'CostoManoObra', 'CostoManoObraEstimado', 'SubtotalManoObra', 'SubtotalRepuestos', 'Subtotal', 'Impuesto', 'Total', 'TotalFactura', 'TotalManoObra', 'TotalRepuestos', 'TotalPagado', 'Saldo', 'SaldoPendiente', 'Monto'])
const instantColumns = new Set(['FechaIngreso', 'Fecha', 'FechaUltimoMovimiento', 'FechaCompra', 'FechaMovimiento', 'FechaFactura', 'FechaPago', 'FechaCambio', 'FechaEntrega', 'FechaDiagnostico', 'FechaInicio', 'FechaFin', 'FechaActividad', 'FechaAsignacion', 'FechaRegistro'])

export function formatReportValue(key: string, value: ReportRow[string] | undefined): string {
  key = [...moneyColumns, ...instantColumns, 'FechaEstimada'].find(column => reportPublicKey(column) === key) ?? key
  if (value === null) return '—'
  if (value === undefined) return 'Campo no recibido'
  if (moneyColumns.has(key)) return typeof value === 'string' && formatMoney(value) !== '—' ? formatMoney(value) : 'Importe no verificable'
  if (instantColumns.has(key)) return typeof value === 'string' ? formatGuatemalaDateTime(value) : 'Fecha no verificable'
  if (key === 'FechaEstimada') return typeof value === 'string' && formatCivilDate(value) !== '—' ? formatCivilDate(value) : 'Fecha civil no verificable'
  return typeof value === 'boolean' ? value ? 'Sí' : 'No' : String(value)
}
