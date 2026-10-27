import { ApiError, notifySessionInvalid } from './api-client'

export type DownloadType = 'csv' | 'xlsx' | 'pdf'
const contentTypes: Record<DownloadType, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeFilename(value: string) {
  const last = value.split(/[\\/]/).pop() ?? ''
  return [...last].map(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || '<>:"|?*'.includes(char) ? '_' : char).join('').replace(/^\.+|[. ]+$/g, '').slice(0, 180) || 'descarga'
}

function filenameFromHeader(header: string | null, fallback: string) {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try { return safeFilename(decodeURIComponent(encoded)) } catch { /* Fall back to the plain filename. */ }
  }
  return safeFilename(header?.match(/filename="([^"]+)"|filename=([^;]+)/i)?.slice(1).find(Boolean)?.trim() ?? fallback)
}

/** One authenticated GET; a failed download is never retried automatically. */
export async function fetchDownload(path: string, options: { type: DownloadType; filename: string; signal?: AbortSignal }) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || [...path].some(char => char.charCodeAt(0) < 32)) {
    throw new ApiError('La ruta debe ser relativa a la API.', 'CONFIGURACION', 0)
  }
  const base = import.meta.env.VITE_API_URL?.trim() || '/api/v1'
  const timeout = AbortSignal.timeout(120_000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method: 'GET', credentials: 'include', cache: 'no-store',
      headers: { Accept: contentTypes[options.type] }, signal,
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError('No se pudo descargar el archivo. Intenta nuevamente cuando haya conexión.', 'RESPUESTA_NO_CONFIRMADA', 0)
  }
  if (options.signal?.aborted) throw options.signal.reason
  if (!response.ok) {
    let body: unknown
    try { body = await response.json() } catch { body = null }
    if (options.signal?.aborted) throw options.signal.reason
    const declared = record(body) && record(body.error) && typeof body.error.code === 'string' && typeof body.error.message === 'string' && typeof body.requestId === 'string'
    if (response.status === 401 || (declared && record(body) && record(body.error) && body.error.code === 'USUARIO_INACTIVO')) notifySessionInvalid()
    if (declared && record(body) && record(body.error)) {
      const details = record(body.error.details) && Object.values(body.error.details).every(value => Array.isArray(value) && value.every(item => typeof item === 'string'))
        ? body.error.details as Record<string, string[]> : undefined
      throw new ApiError(body.error.message as string, body.error.code as string, response.status, body.requestId as string, details)
    }
    throw new ApiError('No se pudo descargar el archivo. El servicio no está disponible.', 'SERVICIO_NO_DISPONIBLE', response.status)
  }
  if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== contentTypes[options.type]) {
    throw new ApiError('La respuesta no contiene el archivo esperado.', 'RESPUESTA_INVALIDA', response.status)
  }
  let blob: Blob
  try { blob = await response.blob() }
  catch {
    if (options.signal?.aborted) throw options.signal.reason
    throw new ApiError('La descarga se interrumpió. Intenta nuevamente.', 'RESPUESTA_NO_CONFIRMADA', 0)
  }
  if (options.signal?.aborted) throw options.signal.reason
  if (!blob.size) throw new ApiError('El archivo recibido está vacío.', 'RESPUESTA_INVALIDA', response.status)
  return { blob, filename: filenameFromHeader(response.headers.get('Content-Disposition'), options.filename) }
}

export async function downloadFile(path: string, options: { type: DownloadType; filename: string; signal?: AbortSignal }) {
  const { blob, filename } = await fetchDownload(path, options)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  try {
    anchor.href = url
    anchor.download = filename
    document.body.append(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(url)
  }
}

export function downloadErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'No se pudo descargar el archivo. Intenta nuevamente.'
  const details = error.details ? Object.values(error.details).flat().join(' ') : ''
  return [error.message, details, error.requestId ? `Referencia: ${error.requestId}` : ''].filter(Boolean).join(' ')
}
