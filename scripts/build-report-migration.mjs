import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
export function reportDefinitions(source) {
  const definitions = source.replace(/\r\n/g, '\n').split(/^\s*GO\s*$/gmi)
    .map(batch => batch.slice(batch.search(/CREATE OR ALTER PROCEDURE/i)).trim())
    .filter(batch => /^CREATE OR ALTER PROCEDURE/i.test(batch))
  if (definitions.length !== 12) throw new Error('Se requieren exactamente doce reportes.')
  const names = definitions.map(def => def.match(/^CREATE OR ALTER PROCEDURE dbo\.(\w+)/i)?.[1])
  if (names.some(name => !/^usp_Reporte\w+$/.test(name)) || new Set(names).size !== 12) throw new Error('Nombres de reportes no validos.')
  return definitions
}

export function buildReportMigration(source) {
  const definitions = reportDefinitions(source)
  const guards = definitions.map(def => {
    const name = def.match(/^CREATE OR ALTER PROCEDURE dbo\.(\w+)/i)[1]
    return ` IF OBJECT_ID(N'dbo.${name}',N'P') IS NULL THROW 51700,N'Falta dbo.${name}.',1;`
  }).join('\n')
  return `/* GENERADO por node scripts/build-report-migration.mjs desde fases/09_reportes.sql.
   Migracion de definiciones solamente. Revisar antes de ejecutar.
   No ejecutado por el generador. No recrea tablas ni carga datos.
   Aplicar a la BD instalada con una cuenta autorizada para ALTER PROCEDURE.
   No usar el maestro para actualizar una BD con datos. */
IF DB_NAME()<>N'TechCareDB' THROW 51700,N'Base de datos no valida.',1;
IF @@TRANCOUNT<>0 THROW 51700,N'La migracion requiere una sesion sin transaccion.',1;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRY
 BEGIN TRANSACTION;
${guards}
${definitions.map(def => ` EXEC(N'${def.replaceAll("'", "''")}');`).join('\n')}
 COMMIT TRANSACTION;
 SELECT N'Reportes actualizados' AS Resultado,12 AS Procedimientos;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
`
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
   if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Uso: node scripts/build-report-migration.mjs [--check]');
  const expected = buildReportMigration(await readFile(resolve(root, 'database/fases/09_reportes.sql'), 'utf8'))
  const target = resolve(root, 'database/migraciones/02_reportes_paginados.sql')
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')).replace(/\r\n/g, '\n') !== expected) throw new Error('Migracion desactualizada. Ejecutar node scripts/build-report-migration.mjs.')
  } else {
    await mkdir(resolve(root, 'database/migraciones'), { recursive: true })
    await writeFile(target, expected)
  }
  console.log(`Reportes: migracion ${process.argv.includes('--check') ? 'consistente' : 'generada'}. No se ejecuto SQL.`)
}
