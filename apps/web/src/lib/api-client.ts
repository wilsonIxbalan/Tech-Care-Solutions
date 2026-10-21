import type { ApiErrorResponse, ApiResponse } from '@/types/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isApiError(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && isRecord(value.error)
    && typeof value.error.code === 'string' && typeof value.error.message === 'string'
    && typeof value.requestId === 'string'
}

type ApiOptions = RequestInit & { token?: string }

/** No automatic retries: a financial POST can succeed even if its response is lost. */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const base = import.meta.env.VITE_API_URL?.trim()
  if (!base) throw new ApiError('Falta configurar VITE_API_URL.', 'CONFIGURACION', 0)
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new ApiError('La ruta debe ser relativa a la API.', 'CONFIGURACION', 0)
  }
  const { token, signal, ...init } = options
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const timeout = AbortSignal.timeout(120_000)
  let response: Response
  try {
    response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      ...init, headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(
      'No se pudo confirmar la respuesta. Si realizaste un pago u otra operación, consulta su resultado antes de repetirla.',
      'RESPUESTA_NO_CONFIRMADA', 0,
    )
  }
  let body: unknown
  try { body = await response.json() } catch { body = null }
  if (!response.ok) {
    if (isApiError(body)) {
      throw new ApiError(body.error.message, body.error.code, response.status, body.requestId, body.error.details)
    }
    throw new ApiError('El servicio no está disponible. Puede estar iniciándose; intenta nuevamente una consulta.',
      'SERVICIO_NO_DISPONIBLE', response.status)
  }
  if (!isRecord(body) || !('data' in body)) {
    throw new ApiError('La respuesta no cumple el contrato esperado.', 'RESPUESTA_INVALIDA', response.status)
  }
  return body as unknown as ApiResponse<T>
}
