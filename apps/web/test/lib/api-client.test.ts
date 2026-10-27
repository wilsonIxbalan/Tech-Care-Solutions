import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, onSessionInvalid } from '@/lib/api-client'

beforeEach(() => vi.stubEnv('VITE_API_URL', 'https://api.example.test/api/v1'))
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('API boundary', () => {
  it('preserves the success envelope and includes session cookies', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { idOrden: 1 } }), { status: 200 }))
    vi.stubGlobal('fetch', mock)
    await expect(apiFetch('/ordenes/1')).resolves.toEqual({ data: { idOrden: 1 } })
    const [url, options] = mock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/ordenes/1')
    expect(options.credentials).toBe('include')
    expect(new Headers(options.headers).has('Authorization')).toBe(false)
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
  it('does not send cookies to a supplied absolute URL', async () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    await expect(apiFetch('https://other.example/steal')).rejects.toMatchObject({ code: 'CONFIGURACION' })
    expect(mock).not.toHaveBeenCalled()
  })
  it('invalidates protected sessions, but not failed logins or ordinary permission denials', async () => {
    const listener = vi.fn()
    const unsubscribe = onSessionInvalid(listener)
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ error: { code: 'SESION_INVALIDA', message: 'Inicia sesión.' }, requestId: 'test' }), { status: 401 })))
    await apiFetch('/auth/login', { method: 'POST', body: '{}' }).catch(() => {})
    expect(listener).not.toHaveBeenCalled()
    await apiFetch('/dashboard').catch(() => {})
    expect(listener).toHaveBeenCalledTimes(1)
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ error: { code: 'PERMISO_DENEGADO', message: 'Sin permiso.' }, requestId: 'test' }), { status: 403 }))
    await apiFetch('/usuarios').catch(() => {})
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
  it('ignores late unauthorized responses from cancelled requests', async () => {
    const listener = vi.fn()
    const unsubscribe = onSessionInvalid(listener)
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { controller.abort(); return new Response('{}', { status: 401 }) }))
    await apiFetch('/dashboard', { signal: controller.signal }).catch(() => {})
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
