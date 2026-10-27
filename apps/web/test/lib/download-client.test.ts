import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, onSessionInvalid } from '@/lib/api-client'
import { downloadFile, fetchDownload } from '@/lib/download-client'

beforeEach(() => vi.stubEnv('VITE_API_URL', 'https://api.example.test/api/v1'))
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const options = { type: 'csv' as const, filename: 'reporte.csv' }

describe('descargas autenticadas', () => {
  it.each([
    ['csv', 'text/csv; charset=utf-8'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['pdf', 'application/pdf'],
  ] as const)('lee un blob %s con cookies y sin credenciales de bearer', async (type, contentType) => {
    const mock = vi.fn().mockResolvedValue(new Response('contenido', { headers: { 'Content-Type': contentType, 'Content-Disposition': "attachment; filename*=UTF-8''informe%20octubre.csv" } }))
    vi.stubGlobal('fetch', mock)
    const result = await fetchDownload('/reportes/ingresos/exportar?formato=csv&conjunto=1', { ...options, type })
    expect(result.filename).toBe('informe octubre.csv')
    expect(result.blob.size).toBe(9)
    expect(mock.mock.calls[0][0]).toBe('https://api.example.test/api/v1/reportes/ingresos/exportar?formato=csv&conjunto=1')
    const init = mock.mock.calls[0][1] as RequestInit
    expect(init).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' })
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it.each([400, 403, 404, 413])('conserva ApiError JSON %s con detalles y referencia', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'LIMITE', message: 'Reduce los filtros.', details: { fechaDesde: ['Intervalo demasiado amplio.'] } }, requestId: 'download-test' }), { status, headers: { 'Content-Type': 'application/json' } })))
    await expect(fetchDownload('/reportes/ingresos/exportar', options)).rejects.toMatchObject({ name: 'ApiError', status, code: 'LIMITE', requestId: 'download-test', details: { fechaDesde: ['Intervalo demasiado amplio.'] } })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('usa la misma señal de sesión inválida para 401 e inactivo, no para 403', async () => {
    const listener = vi.fn()
    const unsubscribe = onSessionInvalid(listener)
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Unauthorized</html>', { status: 401 })))
      await expect(fetchDownload('/facturas/1/pdf', { ...options, type: 'pdf' })).rejects.toBeInstanceOf(ApiError)
      expect(listener).toHaveBeenCalledTimes(1)
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { code: 'USUARIO_INACTIVO', message: 'Usuario inactivo.' }, requestId: 'inactive' }), { status: 403 }))
      await fetchDownload('/facturas/1/pdf', { ...options, type: 'pdf' }).catch(() => {})
      expect(listener).toHaveBeenCalledTimes(2)
      vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 403 }))
      await fetchDownload('/facturas/1/pdf', { ...options, type: 'pdf' }).catch(() => {})
      expect(listener).toHaveBeenCalledTimes(2)
    } finally { unsubscribe() }
  })
  it('no invalida sesiones por respuestas tardías de solicitudes canceladas', async () => {
    const listener = vi.fn()
    const unsubscribe = onSessionInvalid(listener)
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { controller.abort(); return new Response('{}', { status: 401 }) }))
    await fetchDownload('/facturas/1/pdf', { ...options, signal: controller.signal }).catch(() => {})
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
  it.each(['https://evil.test/download', '//evil.test/download', '/\\evil.test/download'])('rechaza rutas externas %s', async path => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(fetchDownload(path, options)).rejects.toMatchObject({ code: 'CONFIGURACION' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('no descarga HTML, JSON exitoso ni archivos vacíos como si fueran CSV', async () => {
    for (const [body, contentType] of [['<html>Starting</html>', 'text/html'], ['{"data":[]}', 'application/json'], ['', 'text/csv']]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': contentType } })))
      await expect(fetchDownload('/reportes/inventario/exportar', options)).rejects.toMatchObject({ code: 'RESPUESTA_INVALIDA' })
    }
  })
  it('no reintenta fallos de red ni expone HTML de errores del proveedor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')))
    await expect(fetchDownload('/facturas/1/pdf', options)).rejects.toMatchObject({ code: 'RESPUESTA_NO_CONFIRMADA' })
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.mocked(fetch).mockResolvedValue(new Response('<html>secret</html>', { status: 503 }))
    await expect(fetchDownload('/facturas/1/pdf', options)).rejects.toMatchObject({ code: 'SERVICIO_NO_DISPONIBLE' })
  })
  it('descarga con nombre saneado, elimina el enlace y libera la URL incluso si falla el clic', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('archivo', { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="../../informe.csv"' } })))
    const create = vi.fn().mockReturnValue('blob:descarga')
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('informe.csv')
      expect(document.body.contains(this)).toBe(true)
      throw new Error('clic fallido')
    })
    await expect(downloadFile('/reportes/ingresos/exportar', options)).rejects.toThrow('clic fallido')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:descarga')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
