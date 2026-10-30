// Verificaciones ESTATICAS. No importa mssql, no lee .env y nunca ejecuta SQL.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSchema } from '../build-er.mjs'

const root = new URL('../../', import.meta.url)
const source = await readFile(new URL('database/semillas/01_datos_demostracion.sql', root), 'utf8')
const sql = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\r\n]*/g, '')
const procedures = await readFile(new URL('database/fases/07_procedimientos.sql', root), 'utf8')

test('la asercion financiera usa columnas reales de dbo.Factura, no Id de la variable tabla', async () => {
  const schema = await loadSchema()
  const columns = new Set(schema.tables.find(table => table.name === 'Factura').columns.map(column => column.name))
  const start = sql.lastIndexOf('OR EXISTS(SELECT 1 FROM dbo.Factura f JOIN @Facturas s')
  assert.ok(start >= 0)
  const assertion = sql.slice(start, sql.indexOf('THROW 53014', start))
  const validate = fragment => {
    for (const [, column] of fragment.matchAll(/\bf\.(\w+)/g)) {
      assert.ok(columns.has(column), `dbo.Factura no tiene columna ${column}`)
    }
  }
  validate(assertion)
  assert.match(assertion, /fn_SaldoFactura\(f\.IdFactura\)/)
  // Comprueba que esta prueba detecta precisamente la regresion reportada.
  assert.throws(() => validate(assertion.replace('fn_SaldoFactura(f.IdFactura)', 'fn_SaldoFactura(f.Id)')), /no tiene columna Id/)
})

test('la carga exige confirmacion, base expresa, hash privado y ninguna transaccion previa', () => {
  assert.match(sql, /DECLARE @ConfirmarCarga BIT = 0/)
  assert.match(sql, /IF @ConfirmarCarga <> 1[\s\S]*?THROW 53000/)
  assert.match(sql, /IF DB_NAME\(\) <> N'TechCareDB'/)
  assert.match(sql, /IF @@TRANCOUNT <> 0/)
  assert.match(sql, /<HASH_ARGON2ID_GENERADO_LOCALMENTE>/)
  assert.doesNotMatch(sql, /\$argon2id\$v=19\$m=\d+/)
})

test('una unica transaccion cubre la carga y rechaza ejecuciones simultaneas o repetidas', () => {
  assert.equal((sql.match(/BEGIN TRANSACTION;/g) ?? []).length, 1)
  assert.equal((sql.match(/COMMIT TRANSACTION;/g) ?? []).length, 1)
  assert.match(sql, /sp_getapplock[\s\S]*?@LockOwner='Transaction'/)
  assert.match(sql, /THROW 53007/)
  assert.match(sql, /BEGIN CATCH[\s\S]*?ROLLBACK TRANSACTION;[\s\S]*?THROW;/)
  assert.ok(sql.indexOf('THROW 53014') < sql.indexOf('COMMIT TRANSACTION;'))
})

test('no borra datos, altera protecciones ni actualiza existencias o documentos historicos', () => {
  assert.doesNotMatch(sql, /\b(?:TRUNCATE|DROP|DISABLE|NOCHECK|IDENTITY_INSERT)\b/i)
  assert.doesNotMatch(sql, /\bUPDATE\s+dbo\./i)
  assert.doesNotMatch(sql, /\bINSERT\s+dbo\.(?:InventarioBodega|MovimientoInventario|Factura|Pago|RepuestoReparacion)\b/i)
  // Solo se vacia la variable TVP para construir el detalle de la siguiente compra.
  assert.deepEqual(sql.match(/DELETE\s+FROM\s+[^;]+;/gi), ['DELETE FROM @Detalle;'])
})

test('todos los procedimientos de negocio llamados existen en la fase 07', () => {
  const declared = new Set([...procedures.matchAll(/CREATE OR ALTER PROCEDURE dbo\.(\w+)/g)].map(match => match[1]))
  const used = [...sql.matchAll(/EXEC dbo\.(\w+)/g)].map(match => match[1])
  for (const name of used) assert.ok(declared.has(name), name)
  for (const name of ['sp_RecibirCompra', 'sp_AsignarRepuestoReparacion', 'sp_GenerarFactura', 'sp_RegistrarPago', 'sp_EntregarOrden']) {
    assert.ok(used.includes(name), name)
  }
})

test('la distribucion planeada respeta una orden abierta por equipo y conserva historia multiple', () => {
  assert.match(sql, /WHILE @I<=60/)
  assert.match(sql, /CASE WHEN @I<=3 THEN 1 WHEN @I<=20 THEN @I-2 ELSE @I-20 END/)
  assert.match(sql, /IF EXISTS\(SELECT 1 FROM dbo.OrdenServicio WHERE IdEquipo=@Equipo\)\s+SET @Fecha=SYSUTCDATETIME\(\)/)
  assert.match(sql, /siguiente.FechaIngreso<entrega.FechaEntrega/)
  const all = new Map()
  const open = new Set()
  const states = new Map()
  for (let i = 1; i <= 60; i++) {
    const equipment = i <= 3 ? 1 : i <= 20 ? i - 2 : i - 20
    assert.ok(!open.has(equipment), `Equipo ${equipment} ya abierto`)
    all.set(equipment, (all.get(equipment) ?? 0) + 1)
    const state = i <= 20 ? 'ENTREGADO' : i <= 30 ? 'LISTO' : i <= 35 ? 'REPARACION' : i <= 45 ? 'ESPERANDO_AUTORIZACION' : i <= 50 ? 'DIAGNOSTICO' : i <= 55 ? 'RECIBIDO' : 'CANCELADO'
    if (!['ENTREGADO', 'CANCELADO'].includes(state)) open.add(equipment)
    states.set(state, (states.get(state) ?? 0) + 1)
  }
  assert.equal(all.get(1), 4)
  assert.equal(states.size, 7)
  assert.equal(open.size, 35)
})

test('el plan de compras/consumos produce 90 existencias, 139 movimientos y stock no negativo', () => {
  assert.match(sql, /WHILE @I<=20/)
  assert.match(sql, /IF @I<=18 EXEC dbo.sp_RecibirCompra/)
  assert.match(sql, /IF @I<=30 AND @I%5<>0/)
  assert.match(sql, /WHILE @J<=2/)
  assert.match(sql, /1\+\(\(\(@I-1\)\*2\+@J-1\)%28\)/)
  const inventory = new Map()
  let moves = 0
  for (let i = 1; i <= 18; i++) {
    const warehouse = 1 + Math.floor((i - 1) / 6) % 3
    for (let r = 1 + 5 * ((i - 1) % 6); r <= 5 + 5 * ((i - 1) % 6); r++) {
      inventory.set(`${warehouse}:${r}`, 15 + 5 * Math.floor((i - 1) / 6))
      moves++
    }
  }
  for (let i = 1; i <= 30; i++) {
    if (i % 5 === 0) continue
    const warehouse = 1 + (i - 1) % 3
    for (let j = 1; j <= 2; j++) {
      const part = 1 + ((i - 1) * 2 + j - 1) % 28
      const key = `${warehouse}:${part}`
      const stock = inventory.get(key)
      assert.ok(stock > 0, key)
      inventory.set(key, stock - 1)
      moves++
    }
  }
  inventory.set('1:30', 0)
  moves++
  assert.equal(inventory.size, 90)
  assert.equal(moves, 139)
  assert.ok([...inventory.values()].every(stock => stock >= 0))
  assert.ok(inventory.get('2:30') > 0 && inventory.get('2:30') < 25)
  assert.notEqual(inventory.get('2:1'), inventory.get('3:1'))
})

test('el plan financiero incluye 45 pagos, 20 facturas liquidadas y 10 con saldo', () => {
  assert.match(sql, /IF @I<=25[\s\S]*?@Total\/2/)
  assert.match(sql, /IF @I<=20[\s\S]*?fn_SaldoFactura/)
  assert.match(sql, /IF @I<=30[\s\S]*?sp_GenerarFactura/)
  const counts = Array.from({ length: 30 }, (_, index) => index < 20 ? 2 : index < 25 ? 1 : 0)
  assert.equal(counts.reduce((sum, value) => sum + value, 0), 45)
  assert.equal(counts.filter(value => value === 2).length, 20)
  assert.equal(counts.filter(value => value < 2).length, 10)
})

test('la API y los maestros no ejecutan ni incluyen la semilla', async () => {
  for (const file of ['database/TechCare_Master.sql', 'database/TechCare_Local.sql', 'scripts/build-sql.mjs', 'apps/api/src/main.ts']) {
    const text = await readFile(new URL(file, root), 'utf8')
    assert.doesNotMatch(text, /01_datos_demostracion|semillas\//)
  }
})
