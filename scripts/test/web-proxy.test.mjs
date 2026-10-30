import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backendOrigin, checkProxy, configureProxy } from '../configure-web-proxy.mjs'

const base = { $schema: 'https://openapi.vercel.sh/vercel.json', headers: [{ source: '/a', headers: [] }], rewrites: [{ source: '/(.*)', destination: '/index.html' }] }
// Dominio sintetico usado SOLO para comprobar serializacion; no se consulta.
const origin = 'https://techcare-unit.onrender.com'
test('proxy conserva configuracion y precede el fallback SPA', () => {
  const result = configureProxy(base, origin)
  assert.deepEqual(result.rewrites[0], { source: '/api/:path*', destination: `${origin}/api/:path*` })
  assert.deepEqual(result.rewrites[1], base.rewrites[0])
  assert.deepEqual(result.headers, base.headers)
  assert.equal(base.rewrites.length, 1)
  assert.equal(checkProxy(result), true)
  assert.deepEqual(configureProxy(result, origin), result)
})
test('no acepta placeholders, HTTP, rutas ni secretos incrustados', () => {
  for (const value of [undefined, '', 'http://api.onrender.com', `${origin}/`, `${origin}/api/v1`, `${origin}?secret=x`, `${origin}#x`, 'https://user:pass@api.onrender.com', 'https://localhost', 'https://127.0.0.1', 'https://example.invalid', 'https://example.com']) {
    assert.throws(() => backendOrigin(value), /origen|URL/)
  }
})
test('despliegue falla sin host definitivo o si /api esta despues del catch-all', () => {
  assert.throws(() => checkProxy(base), /Despliegue bloqueado/)
  assert.throws(() => checkProxy({ rewrites: [base.rewrites[0], { source: '/api/:path*', destination: `${origin}/api/:path*` }] }), /Despliegue bloqueado/)
  assert.throws(() => configureProxy({ rewrites: [], routes: [] }, origin), /routes/)
  assert.throws(() => configureProxy({}, origin), /rewrites/)
})
