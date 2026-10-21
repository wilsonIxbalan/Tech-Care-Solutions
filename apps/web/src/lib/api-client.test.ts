import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/api-client'

beforeEach(() => vi.stubEnv('VITE_API_URL', 'https://api.example.test/api/v1'))
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('API boundary', () => {
  it('preserves the success envelope and sends a bearer token', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { idOrden: 1 } }), { status: 200 }))
    vi.stubGlobal('fetch', mock)
    await expect(apiFetch('/ordenes/1', { token: 'example-only' })).resolves.toEqual({ data: { idOrden: 1 } })
    const [url, options] = mock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/ordenes/1')
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer example-only')
  })
  it('maps a declared business error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'STOCK_INSUFICIENTE', message: 'Stock insuficiente.' }, requestId: 'test-request',
    }), { status: 409 })))
    await expect(apiFetch('/reparaciones/1/repuestos', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      status: 409, code: 'STOCK_INSUFICIENTE', requestId: 'test-request',
    })
  })
  it('never retries a failed mutation or exposes a provider HTML error', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('<html>Starting</html>', { status: 503 }))
    vi.stubGlobal('fetch', mock)
    await expect(apiFetch('/facturas/1/pagos', { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'SERVICIO_NO_DISPONIBLE' })
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('does not send tokens to a supplied absolute URL', async () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    await expect(apiFetch('https://other.example/steal', { token: 'example-only' })).rejects.toMatchObject({ code: 'CONFIGURACION' })
    expect(mock).not.toHaveBeenCalled()
  })
})
