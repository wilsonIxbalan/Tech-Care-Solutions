import { ApiError, apiFetch } from '@/lib/api-client'
import type { ApiResponse } from '@/types/api'
import type { CompraResumenDto, FacturaResumenDto } from '@/types/domain'
import type { ReportCatalog, ReportCatalogos, ReportOption } from './reportes-model'

export type RemoteReportCatalog = 'clientes' | 'ordenes' | 'bodegas' | 'repuestos' | 'proveedores'
const remoteCatalogs: readonly string[] = ['clientes', 'ordenes', 'bodegas', 'repuestos', 'proveedores']
export function isRemoteReportCatalog(catalog?: ReportCatalog): catalog is RemoteReportCatalog {
  return !!catalog && remoteCatalogs.includes(catalog)
}

const purchaseStates = ['PENDIENTE', 'RECIBIDA', 'ANULADA'] as const satisfies readonly CompraResumenDto['estado'][]
const invoiceStates = ['EMITIDA', 'PAGADA', 'ANULADA'] as const satisfies readonly FacturaResumenDto['estado'][]
const stateLabels: Record<string, string> = { PENDIENTE: 'Pendiente', RECIBIDA: 'Recibida', ANULADA: 'Anulada', EMITIDA: 'Emitida', PAGADA: 'Pagada' }
export const reportStateOptions: ReportCatalogos = {
  estadosCompra: purchaseStates.map(value => ({ value, label: stateLabels[value] })),
  estadosFactura: invoiceStates.map(value => ({ value, label: stateLabels[value] })),
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function invalid(): never { throw new ApiError('No se pudieron interpretar las opciones recibidas.', 'RESPUESTA_INVALIDA', 200) }

export function parseReportCatalogs(data: unknown): ReportCatalogos {
  if (!object(data)) return invalid()
  const result: ReportCatalogos = { ...reportStateOptions }
  for (const [catalog, source, byCode] of [
    ['prioridades', 'prioridades', false], ['estadosOrden', 'estadosOrden', true],
    ['tecnicos', 'tecnicos', false], ['categorias', 'categoriasRepuesto', false], ['tiposMovimiento', 'tiposMovimiento', true],
  ] as const) {
    const received = data[source]
    if (!Array.isArray(received)) return invalid()
    result[catalog] = received.map(row => {
      if (!object(row) || typeof row.nombre !== 'string' || (byCode ? typeof row.codigo !== 'string' : !Number.isInteger(row.id) || Number(row.id) <= 0)) return invalid()
      return { value: String(byCode ? row.codigo : row.id), label: row.nombre }
    })
  }
  return result
}

const lookupFields: Record<RemoteReportCatalog, { id: string; label: string; detail: string }> = {
  clientes: { id: 'idCliente', label: 'nombreMostrar', detail: 'nit' },
  ordenes: { id: 'idOrden', label: 'numeroOrden', detail: 'clienteNombre' },
  bodegas: { id: 'idBodega', label: 'nombre', detail: 'codigo' },
  repuestos: { id: 'idRepuesto', label: 'nombre', detail: 'codigo' },
  proveedores: { id: 'idProveedor', label: 'nombre', detail: 'nit' },
}

export async function getReportLookup(catalog: RemoteReportCatalog, search: string, page: number, signal: AbortSignal, pageSize = 20): Promise<{ options: ReportOption[]; meta: NonNullable<ApiResponse<unknown>['meta']> }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search) params.set('search', search)
  const response = await apiFetch<unknown>(`/${catalog}?${params}`, { signal })
  const meta = response.meta
  if (!Array.isArray(response.data) || !meta || ![meta.page, meta.pageSize, meta.total, meta.totalPages].every(Number.isInteger)
    || meta.page !== page || meta.pageSize !== pageSize || meta.total < 0 || meta.totalPages < 0) return invalid()
  const fields = lookupFields[catalog]
  const options = response.data.map(row => {
    if (!object(row) || !Number.isInteger(row[fields.id]) || Number(row[fields.id]) <= 0 || typeof row[fields.label] !== 'string') return invalid()
    const detail = row[fields.detail]
    return { value: String(row[fields.id]), label: `${row[fields.label]}${typeof detail === 'string' && detail ? ` · ${detail}` : ''}` }
  })
  return { options, meta }
}

export function reportLookupError(error: unknown) {
  if (!(error instanceof ApiError)) return 'No se pudieron cargar las opciones. Intenta nuevamente.'
  return [error.message, error.details ? Object.values(error.details).flat().join(' ') : '', error.requestId ? `Referencia: ${error.requestId}` : ''].filter(Boolean).join(' ')
}
