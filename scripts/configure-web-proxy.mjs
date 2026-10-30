import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const configPath = fileURLToPath(new URL('../apps/web/vercel.json', import.meta.url))

export function backendOrigin(value) {
  if (!value) throw new Error('Falta TECHCARE_BACKEND_ORIGIN: indicar el origen HTTPS real del backend, sin /api ni credenciales.')
  let url
  try { url = new URL(value) } catch { throw new Error('El origen del backend no es una URL valida.') }
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password
    || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    || /\.(?:invalid|test|example)$/.test(url.hostname) || url.hostname === 'example.com') {
    throw new Error('Usar un origen HTTPS real y exacto, sin ruta, barra final, query, credenciales ni placeholders.')
  }
  return url.origin
}

export function configureProxy(previous, origin) {
  const destination = `${backendOrigin(origin)}/api/:path*`
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)
    || !Array.isArray(previous.rewrites)) throw new Error('vercel.json requiere rewrites explicitos; revisar la configuracion antes de reemplazarla.')
  if (previous.routes) throw new Error('No mezclar routes con rewrites; revisar manualmente.')
  // No eliminar headers ni otras preferencias existentes. /api se evalua antes
  // del fallback SPA y mantiene rutas binarias, cookies y el contrato /api/v1.
  const rewrites = previous.rewrites.filter(rule => rule.source !== '/api/:path*')
  if (rewrites.some(rule => typeof rule.source !== 'string' || typeof rule.destination !== 'string'))
    throw new Error('Rewrite no reconocido; revisar manualmente.')
  return { ...previous, rewrites: [{ source: '/api/:path*', destination }, ...rewrites] }
}

export function checkProxy(config) {
  const first = config?.rewrites?.[0]
  if (first?.source !== '/api/:path*' || !first.destination?.endsWith('/api/:path*'))
    throw new Error('Despliegue bloqueado: falta el proxy /api antes del fallback SPA. Ejecutar pnpm deploy:configure-web con TECHCARE_BACKEND_ORIGIN real.')
  backendOrigin(first.destination.slice(0, -'/api/:path*'.length))
  return true
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--check')) throw new Error('Uso: node scripts/configure-web-proxy.mjs [--check]; origen desde TECHCARE_BACKEND_ORIGIN.')
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  if (args.includes('--check')) checkProxy(config)
  else {
    const next = configureProxy(config, process.env.TECHCARE_BACKEND_ORIGIN)
    await writeFile(configPath, JSON.stringify(next, null, 2) + '\n')
  }
  console.log(args.includes('--check') ? 'Proxy web preparado. Aun requiere prueba HTTPS real de sesion y descargas.' : 'Proxy configurado. Revisar diff y probar cookie/Origin con HTTPS antes de publicar.')
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
