import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('../../', import.meta.url)
const source = await readFile(new URL('database/semillas/02_escenarios_realistas.sql', root), 'utf8')
const sql = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\r\n]*/g, '')
const procedures = await readFile(new URL('database/fases/07_procedimientos.sql', root), 'utf8')
test('RL26 es adicional, exige confirmacion y no agrega credenciales ni usuarios', () => {
  assert.match(sql, /DECLARE @ConfirmarCarga BIT=0/)
  assert.match(sql, /IF DB_NAME\(\)<>N'TechCareDB'/)
  assert.match(sql, /IF @@TRANCOUNT<>0/)
  assert.match(sql, /IF \(@@OPTIONS & 2\)=2 THROW 53102/)
  assert.match(sql, /THROW 53106/)
  assert.doesNotMatch(sql, /INSERT\s+dbo\.(?:Usuario|UsuarioRol)\b|PasswordHash|\$argon2|@Hash/i)
  assert.doesNotMatch(sql, /\b(?:TRUNCATE|DROP|DISABLE|NOCHECK|IDENTITY_INSERT)\b/i)
  assert.doesNotMatch(sql, /UPDATE\s+dbo\.|DELETE\s+(?:FROM\s+)?dbo\./i)
  assert.ok(!sql.includes('SEM26'))
})
test('actores y roles se comprueban antes de cargar; transaccion exterior y rollback', () => {
  assert.equal((sql.match(/BEGIN TRANSACTION;/g) ?? []).length, 1)
  assert.equal((sql.match(/COMMIT TRANSACTION;/g) ?? []).length, 1)
  assert.match(sql, /sp_getapplock[\s\S]*?@LockOwner='Transaction'/)
  for (const role of ['RECEPCION', 'TECNICO', 'BODEGA', 'CAJA']) assert.ok(sql.includes(`,'${role}')=0`))
  assert.ok(sql.indexOf('THROW 53105') < sql.indexOf('INSERT dbo.Cliente'))
  assert.match(sql, /BEGIN CATCH\s+IF XACT_STATE\(\)<>0 ROLLBACK TRANSACTION;\s+THROW;/)
})
test('nombres y equipos son descriptivos con contactos reservados de prueba', () => {
  assert.ok(sql.includes('Mariana'))
  assert.ok(sql.includes('Clínica Horizonte Integral'))
  assert.ok(sql.includes('ProBook 450 G8'))
  assert.ok(sql.includes('No siempre') || sql.includes('no siempre'))
  assert.ok(sql.includes('@example.invalid'))
  assert.doesNotMatch(sql, /'Cliente\s+(?:demo\s+)?\d+/i)
})
test('todo stock y proceso financiero usa procedimientos existentes', () => {
  const declared = new Set([...procedures.matchAll(/CREATE OR ALTER PROCEDURE dbo\.(\w+)/g)].map(match => match[1]))
  const used = [...sql.matchAll(/EXEC dbo\.(\w+)/g)].map(match => match[1])
  for (const name of used) assert.ok(declared.has(name), name)
  assert.doesNotMatch(sql, /INSERT\s+dbo\.(?:InventarioBodega|MovimientoInventario|Factura|Pago|RepuestoReparacion)\b/i)
  for (const name of ['sp_RecibirCompra', 'sp_AsignarRepuestoReparacion', 'sp_GenerarFactura', 'sp_RegistrarPago', 'sp_EntregarOrden']) assert.ok(used.includes(name))
})
test('el plan deja procesos completos y trabajos listos para probar manualmente', () => {
  const pieceList = sql.slice(sql.indexOf('INSERT @Escenarios VALUES'), sql.indexOf('DECLARE @N INT'))
  const rows = [...pieceList.matchAll(/^\s*\((\d+),.*?,(\d+|NULL),(\d+|NULL)\)[,;]/gm)]
  assert.equal(rows.length, 24)
  let consumed = 0
  for (const row of rows) if (Number(row[1]) <= 14) consumed += Number(row[2] !== 'NULL') + Number(row[3] !== 'NULL')
  assert.equal(consumed, 18)
  assert.match(sql, /IF @N<=10[\s\S]*?sp_FinalizarReparacion/)
  assert.match(sql, /IF @N<=8[\s\S]*?sp_GenerarFactura/)
  assert.match(sql, /IF @N<=7[\s\S]*?sp_RegistrarPago/)
  assert.match(sql, /IF @N<=6[\s\S]*?sp_EntregarOrden/)
  assert.equal(9 * 6 + consumed + 1, 73)
  assert.equal(6 * 2 + 1, 13)
  assert.ok(sql.indexOf('THROW 53114') < sql.indexOf('COMMIT TRANSACTION;'))
})
