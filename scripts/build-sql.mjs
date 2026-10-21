import { readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const database = resolve(root, 'database')
const phases = [
  '01_tablas.sql', '02_relaciones.sql', '03_indices_secuencias_tipos.sql',
  '04_funciones.sql', '05_vistas.sql', '06_catalogos.sql', '07_procedimientos.sql',
  '08_triggers.sql', '09_reportes.sql', '10_permisos.sql', '11_verificacion.sql',
]
const found = (await readdir(resolve(database, 'fases'))).filter(x => x.endsWith('.sql')).sort()
if (JSON.stringify(found) !== JSON.stringify(phases)) throw new Error('La lista de fases debe ser explicita y estar ordenada.')
const declared = new Set()
const parts = []
for (const name of phases) {
  const text = (await readFile(resolve(database, 'fases', name), 'utf8')).replace(/\r\n/g, '\n').trimEnd()
  if (/\bDROP\s+(?:DATABASE|TABLE)\b|\bNOCHECK\b|\bDISABLE\s+TRIGGER\b/i.test(text)) throw new Error(`Operacion destructiva inesperada: ${name}`)
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
  for (const batch of clean.split(/^\s*GO\s*$/gmi)) {
    for (const match of batch.matchAll(/\bCREATE\s+(?:OR\s+ALTER\s+)?(?:TABLE|FUNCTION|VIEW|PROCEDURE|TRIGGER|SEQUENCE|TYPE)\s+dbo\.(\w+)/gi)) declared.add(match[1].toLowerCase())
    for (const match of batch.matchAll(/\bdbo\.(\w+)/gi)) {
      if (!declared.has(match[1].toLowerCase())) throw new Error(`Dependencia dbo.${match[1]} aun no declarada en ${name}.`)
    }
  }
  parts.push(`/* ===== fases/${name} ===== */\n${text}\n`)
}
const header = `/* GENERADO por pnpm sql:build. Editar fases, no este archivo.\n   SQL Server 2022 / Azure SQL Database. Conectar a una BD de proyecto VACIA.\n   Ejecutar con cliente que detenga al primer error (sqlcmd -b o SQLCMD :ON ERROR EXIT).\n   NO ejecutar sobre la BD compartida con datos. Sin DROP, usuarios ni secretos. */\n`
const core = header + parts.join('\n')
const local = `/* GENERADO: instalacion completa en SQL Server local desde instancia vacia.\n   Ejecutar con sqlcmd -b. No usar en Azure. No borra la base si ya existe. */\nUSE master;\nGO\n`
  + (await readFile(resolve(database, '00_preparacion/00_crear_bd_local.sql'), 'utf8')).replace(/\r\n/g, '\n').trimEnd()
  + '\nUSE TechCareDB;\nGO\n' + core
for (const [name, expected] of [['TechCare_Master.sql', core], ['TechCare_Local.sql', local]]) {
  const path = resolve(database, name)
  if (process.argv.includes('--check')) {
    const actual = await readFile(path, 'utf8')
    if (actual.replace(/\r\n/g, '\n') !== expected) throw new Error(`${name} desactualizado. Ejecutar pnpm sql:build.`)
  } else await writeFile(path, expected)
}
console.log(`${phases.length} fases: ${process.argv.includes('--check') ? 'maestros consistentes' : 'maestros generados'}. No se ejecuto SQL.`)
