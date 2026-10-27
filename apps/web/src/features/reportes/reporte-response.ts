import { ApiError } from '@/lib/api-client'
import type { ApiResponse } from '@/types/api'
import { reportPublicKey, type ReportDefinition, type ReportRow } from './reportes-model'

type RecordValue = Record<string, unknown>
export interface ReportSection { title: string; rows: ReportRow[]; children?: ReportSection[] }
export interface ReportResult { sections: ReportSection[]; meta?: ApiResponse<unknown>['meta'] }

function object(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function invalid(): never { throw new ApiError('La respuesta del reporte no cumple el contrato esperado.', 'RESPUESTA_INVALIDA', 200) }
function rows(value: unknown): RecordValue[] {
  if (!Array.isArray(value) || !value.every(object)) return invalid()
  return value
}
function scalar(value: unknown): value is ReportRow[string] {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
}
function scalarRow(value: RecordValue): ReportRow {
  const entries = Object.entries(value).filter(([, item]) => scalar(item))
  return Object.fromEntries(entries) as ReportRow
}

const relationshipTitles: Record<string, string> = {
  ordenes: 'Órdenes', historial: 'Historial de estados', diagnosticos: 'Diagnósticos', reparaciones: 'Reparaciones',
  actividades: 'Actividades', repuestos: 'Consumos de repuestos', factura: 'Factura', detalles: 'Líneas de factura', pagos: 'Pagos', entrega: 'Entrega', movimientos: 'Movimientos de inventario',
}

function resource(title: string, value: unknown): ReportSection {
  if (value === null) return { title, rows: [] }
  if (!object(value)) return invalid()
  const children: ReportSection[] = []
  for (const [key, label] of Object.entries(relationshipTitles)) {
    if (!(key in value)) continue
    if (['factura', 'entrega'].includes(key)) children.push(resource(label, value[key]))
    else children.push(collection(label, value[key]))
  }
  return { title, rows: [scalarRow(value)], children }
}

function collection(title: string, value: unknown): ReportSection {
  const received = rows(value)
  const nested = received.some(row => Object.keys(relationshipTitles).some(key => key in row))
  return nested
    ? { title, rows: [], children: received.map((row, index) => resource(`${title} · ${String(row.numeroOrden ?? row.numeroFactura ?? row.idReparacion ?? index + 1)}`, row)) }
    : { title, rows: received.map(scalarRow) }
}

export function parseReportResponse(report: ReportDefinition, response: ApiResponse<unknown>): ReportResult {
  const data = response.data
  if (report.id === 'historial-cliente' || report.id === 'historial-equipo') {
    if (!object(data)) return invalid()
    const key = report.id === 'historial-cliente' ? 'cliente' : 'equipo'
    if (!object(data[key])) return invalid()
    return { sections: [resource(key === 'cliente' ? 'Cliente' : 'Equipo', data[key]), collection('Órdenes', data.ordenes)] }
  }
  if (report.id === 'trazabilidad') {
    if (!object(data) || !object(data.orden)) return invalid()
    for (const key of ['historial', 'diagnosticos', 'reparaciones', 'movimientos', 'pagos']) rows(data[key])
    for (const key of ['factura', 'entrega']) if (data[key] !== null && !object(data[key])) return invalid()
    return { sections: [resource('Orden', data.orden), ...Object.entries(relationshipTitles).filter(([key]) => key !== 'ordenes' && key in data).map(([key, title]) => ['factura', 'entrega'].includes(key) ? resource(title, data[key]) : collection(title, data[key]))] }
  }
  const received = rows(data)
  const columns = report.sets[0].columns.map(reportPublicKey)
  const sections: ReportSection[] = [{ title: report.sets[0].title, rows: received.map(row => Object.fromEntries(columns.map(key => {
    if (key in row && !scalar(row[key])) return invalid()
    return [key, row[key]]
  })) as ReportRow) }]
  if (report.id === 'facturas-saldo') {
    sections.push({ title: 'Pagos de las facturas consultadas', rows: received.flatMap(row => rows(row.pagos).map(scalarRow)) })
  }
  return { sections, meta: response.meta }
}
