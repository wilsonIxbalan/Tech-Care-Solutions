import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, relative, dirname } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const ignored = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite', '.vercel', '.artifacts'])
const forbidden = new Set(['docs', 'reference', 'guias-equipo'])
const sharedDocs = new Set([
  'Docs/01-arquitectura-flujos.md',
  'Docs/02-contratos-dtos.md',
  'Docs/03-endpoints-bd.md',
  'Docs/04-errores-seguridad.md',
  'Docs/05-frontend-diseno.md',
])
const localAgentDirectories = new Set(['.cursor', '.agents', '.claude', '.opencode'])
const localAgentFile = /^(?:AGENTS|CLAUDE)\.md$/i
function isAgentPath(name) {
  const segments = name.replaceAll('\\', '/').split('/')
  return segments.some(segment => localAgentDirectories.has(segment)) || localAgentFile.test(segments.at(-1))
}
let failures = 0
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name) || localAgentDirectories.has(entry.name) || localAgentFile.test(entry.name)) continue
    const full = resolve(dir, entry.name)
    const name = relative(root, full).replaceAll('\\', '/')
    if (entry.isDirectory()) {
      if (forbidden.has(entry.name)) { console.error(`Carpeta no versionable: ${name}`); failures++; continue }
      await walk(full)
    } else {
      if (/^apps\/(?:web|api)\/src\//.test(name) && (
        /\.(?:test|spec|e2e-spec)\.[cm]?[jt]sx?$/.test(name)
        || /\/(?:test|tests|__tests__|__mocks__|fixtures)\//.test(name)
      )) {
        console.error(`Las pruebas y fixtures deben estar fuera de src: ${name}`); failures++
      }
      if (name.startsWith('database/') && !name.endsWith('.sql')) { console.error(`database solo admite scripts SQL: ${name}`); failures++ }
      if (name.endsWith('.md') && !name.startsWith('seguimiento/') && name !== 'apps/web/THIRD_PARTY_NOTICES.md' && !sharedDocs.has(name)) {
        console.error(`Markdown no previsto en el repositorio: ${name}`); failures++
      }
      if (/^(?:package-lock\.json|yarn\.lock)$/.test(entry.name)) { console.error(`Usar solo pnpm: ${name}`); failures++ }
      // Un .env privado local es necesario para desarrollar. Se comprueba abajo
      // que no este agregado a Git, sin abrirlo ni imprimir su contenido.
    }
  }
}
await walk(root)
for (const name of sharedDocs) {
  const full = resolve(root, name)
  if (!existsSync(full)) { console.error(`Documento tecnico requerido: ${name}`); failures++; continue }
  const content = await readFile(full, 'utf8')
  if ((content.match(/^```/gm) ?? []).length % 2 !== 0) { console.error(`Bloque de codigo sin cerrar: ${name}`); failures++ }
  const prose = content.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '')
  for (const match of prose.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue
    if (!existsSync(resolve(dirname(full), decodeURIComponent(target)))) { console.error(`Enlace inexistente: ${name} -> ${target}`); failures++ }
  }
}
// La presencia local esta permitida; lo que se prohíbe es versionarla.
// gitignore no retira un archivo que ya estaba agregado al indice.
if (existsSync(resolve(root, '.git'))) {
  const tracked = spawnSync('git', ['ls-files', '--cached', '-z'], { cwd: root, encoding: 'utf8' })
  if (tracked.status !== 0) { console.error('No se pudo comprobar el indice de Git.'); failures++ }
   else for (const name of tracked.stdout.split('\0').filter(Boolean)) {
     if (isAgentPath(name)) { console.error(`Configuracion personal agregada a Git: ${name}`); failures++ }
     const filename = name.split('/').at(-1)
     if (filename.startsWith('.env') && filename !== '.env.example') {
       console.error(`Archivo de secretos agregado a Git: ${name}`); failures++
     }
   }
}
const ci = await readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8')
if (!ci.includes('branches: [developer, main]')) { console.error('CI debe comprobar developer.'); failures++ }
console.log(`Estructura: ${failures} errores. No crea Git ni ejecuta SQL.`)
process.exitCode = failures ? 1 : 0
