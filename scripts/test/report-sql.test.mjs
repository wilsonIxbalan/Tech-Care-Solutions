import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildReportMigration, reportDefinitions } from '../build-report-migration.mjs'

const root = resolve(import.meta.dirname, '../..')
const source = await readFile(resolve(root, 'database/fases/09_reportes.sql'), 'utf8')
const migration = (await readFile(resolve(root, 'database/migraciones/02_reportes_paginados.sql'), 'utf8')).replace(/\r\n/g, '\n')
const definitions = reportDefinitions(source)
const reports = Object.fromEntries(definitions.map(sql => [sql.match(/dbo\.usp_Reporte(\w+)/)[1], sql]))
// Independent public contracts, in resultset/column order. No internal sort keys.
const columns = {
  OrdenesActivas: ['IdOrden,NumeroOrden,FechaIngreso,FechaEstimada,Estado,Prioridad,ClienteNombre,NumeroSerie,TipoEquipo,Marca,IdTecnico,TecnicoResponsable'],
  HistorialCliente: ['IdCliente,NombreMostrar,TipoCliente,NIT', 'IdCliente,IdEquipo,NumeroSerie,IdOrden,NumeroOrden,FechaIngreso,Estado,Prioridad,IdDiagnostico,Diagnostico,Tecnico,NumeroFactura,TotalFactura'],
  HistorialEquipo: ['IdEquipo,NumeroSerie,Modelo,TipoEquipo,Marca,ClienteNombre', 'IdEquipo,NumeroSerie,IdOrden,NumeroOrden,FechaIngreso,ProblemaReportado,EstadoOrden,IdDiagnostico,Diagnostico,EstadoDiagnostico,TecnicoDiagnostico,TotalManoObra,TotalRepuestos,IdFactura,NumeroFactura,TotalFactura,FechaEntrega'],
  ActividadTecnico: ['Tipo,IdRegistro,IdOrden,NumeroOrden,NumeroSerie,IdTecnico,TecnicoNombre,Fecha,Descripcion,Costo,Estado'],
  RepuestosUtilizados: ['IdRepuestoReparacion,IdOrden,NumeroOrden,IdReparacion,IdTecnico,TecnicoNombre,IdBodega,BodegaNombre,Codigo,RepuestoNombre,Cantidad,PrecioCostoUnitario,PrecioVentaUnitario,Subtotal,Estado'],
  Inventario: ['IdBodega,BodegaNombre,IdCategoria,CategoriaNombre,IdRepuesto,Codigo,RepuestoNombre,Existencia,StockMinimo,FechaUltimoMovimiento'],
  BajoMinimo: ['IdBodega,BodegaNombre,CategoriaNombre,IdRepuesto,Codigo,RepuestoNombre,Existencia,StockMinimo'],
  ComprasProveedor: ['IdCompra,NumeroCompra,FechaCompra,Estado,IdProveedor,ProveedorNombre,BodegaNombre,UsuarioRegistro,IdDetalleCompra,Codigo,RepuestoNombre,Cantidad,CostoUnitario,Subtotal'],
  Movimientos: ['IdMovimiento,FechaMovimiento,IdBodega,BodegaNombre,IdRepuesto,CodigoRepuesto,RepuestoNombre,TipoMovimiento,Naturaleza,Cantidad,ExistenciaResultante,DocumentoOrigen,NumeroDocumento,UsuarioNombre,Observacion'],
  FacturasSaldo: ['IdFactura,NumeroFactura,IdOrden,NumeroOrden,ClienteNombre,FechaFactura,Estado,Total,TotalPagado,Saldo', 'IdPago,IdFactura,FechaPago,Monto,MetodoPago,Referencia,Estado,UsuarioNombre'],
  Ingresos: ['Anio,Mes,CantidadFacturas,TotalManoObra,TotalRepuestos,Subtotal,Impuesto,Total'],
  Trazabilidad: ['IdOrden,NumeroOrden,FechaIngreso,EstadoOrden,ClienteNombre,NumeroSerie,Recepcionista,IdDiagnostico,Diagnostico,EstadoDiagnostico,TecnicoDiagnostico,IdReparacion,EstadoReparacion,TecnicoReparacion,IdRepuestoReparacion,CodigoRepuesto,Cantidad,PrecioCostoUnitario,PrecioVentaUnitario,IdMovimiento,ExistenciaResultante,IdFactura,NumeroFactura,TotalFactura,TotalPagado,SaldoPendiente,FechaEntrega,NombreRecibe', 'IdPago,FechaPago,Monto,MetodoPagoNombre,Estado,UsuarioNombre', 'IdHistorial,EstadoAnterior,EstadoNuevo,FechaCambio,UsuarioNombre,Observacion'],
}
const searchColumns = {
  OrdenesActivas: 'NumeroOrden,FechaIngreso,FechaEstimada,Estado,Prioridad,ClienteNombre,NumeroSerie,TipoEquipo,Marca,TecnicoResponsable',
  ActividadTecnico: 'Tipo,NumeroOrden,NumeroSerie,TecnicoNombre,Fecha,Descripcion,Costo,Estado',
  RepuestosUtilizados: 'NumeroOrden,TecnicoNombre,BodegaNombre,Codigo,RepuestoNombre,PrecioCostoUnitario,PrecioVentaUnitario,Subtotal,Estado',
  Inventario: 'BodegaNombre,CategoriaNombre,Codigo,RepuestoNombre,FechaUltimoMovimiento',
  BajoMinimo: 'BodegaNombre,CategoriaNombre,Codigo,RepuestoNombre',
  ComprasProveedor: 'NumeroCompra,FechaCompra,Estado,ProveedorNombre,BodegaNombre,UsuarioRegistro,Codigo,RepuestoNombre,CostoUnitario,Subtotal',
  Movimientos: 'FechaMovimiento,BodegaNombre,CodigoRepuesto,RepuestoNombre,TipoMovimiento,Naturaleza,DocumentoOrigen,NumeroDocumento,UsuarioNombre,Observacion',
  FacturasSaldo: 'NumeroFactura,NumeroOrden,ClienteNombre,FechaFactura,Estado,Total,TotalPagado,Saldo',
  Ingresos: 'TotalManoObra,TotalRepuestos,Subtotal,Impuesto,Total',
}
const orders = {
  OrdenesActivas: 'OrdenNivel DESC,FechaIngreso,IdOrden',
  ActividadTecnico: 'Fecha,Tipo,IdRegistro',
  RepuestosUtilizados: 'IdOrden,IdReparacion,IdRepuestoReparacion',
  Inventario: 'IdBodega,IdCategoria,Codigo,IdRepuesto',
  BajoMinimo: 'Existencia,IdBodega,Codigo,IdRepuesto',
  ComprasProveedor: 'FechaCompra DESC,IdCompra,IdDetalleCompra',
  Movimientos: 'IdMovimiento DESC', FacturasSaldo: 'FechaFactura DESC,IdFactura', Ingresos: 'Anio,Mes',
}

test('exactly nine paginated listings and three full histories; optional parameters appended', () => {
  assert.deepEqual(Object.keys(reports).sort(), Object.keys(columns).sort())
  assert.equal(Object.keys(searchColumns).length, 9)
  for (const [name, sql] of Object.entries(reports)) {
    const signature = sql.split(/\nAS\b/)[0]
    assert.match(signature, /@MaxRows INT=NULL$/)
    if (searchColumns[name]) {
      assert.match(signature.replace(/\n\s*/g, ''), /,@Page INT=NULL,@PageSize INT=20,@Search NVARCHAR\(150\)=NULL,@MaxRows INT=NULL$/)
      assert.match(sql, /IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700/)
      assert.match(sql, /IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;\s*END;$/)
      assert.equal((sql.match(/AS TotalRows/g) ?? []).length, 1)
      assert.match(sql, /CONVERT\(BIGINT,@Page\)-1/)
      assert.match(sql, /@Page IS NULL THEN 9223372036854775807 ELSE @PageSize/)
    } else {
      assert.doesNotMatch(sql, /@Page|@Search|AS TotalRows|OFFSET|FETCH/)
    }
    assert.match(sql, /@MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700/)
    assert.match(sql, /DECLARE @TotalRows BIGINT=/)
    assert.doesNotMatch(sql, /\bCOUNT\(/)
  }
})

test('all resultsets retain exact public columns and all data is emitted after the limit check', () => {
  for (const [name, sql] of Object.entries(reports)) {
    assert.doesNotMatch(sql, /SELECT\s+(?:\w+\.)?\*/i)
    assert.doesNotMatch(sql, /\bEXEC(?:UTE)?\b|sp_executesql|\b(?:UPDATE|INSERT|ALTER TABLE|TRUNCATE)\b/i)
    const output = sql.slice(sql.indexOf('THROW 51710'))
    const actual = [...output.matchAll(/\bSELECT ([\w.,\s]+?)\s+FROM #\w+/g)]
      .map(m => m[1].replace(/\b\w+\./g, '').replace(/\s/g, ''))
    assert.deepEqual(actual, columns[name], name)
    const preLimit = sql.slice(0, sql.indexOf('THROW 51710'))
    assert.doesNotMatch(preLimit, /OFFSET|FETCH/)
    for (const statement of preLimit.split(';')) {
      if (/^\s*(?:--[^\n]*\n\s*)?SELECT /m.test(statement)) assert.match(statement, /INTO #/, name)
    }
  }
})

test('search uses only public strings, literal CHARINDEX and explicit Unicode CI/AS collation', () => {
  for (const [name, expected] of Object.entries(searchColumns)) {
    const sql = reports[name]
    const searchStart = sql.indexOf('DELETE r')
    const search = sql.slice(searchStart, sql.indexOf(';', searchStart) + 1)
    const values = search.slice(search.indexOf('(VALUES'), search.indexOf(') v(Texto)'))
    const actual = [...values.matchAll(/r\.(\w+)/g)].map(m => m[1])
    assert.deepEqual(actual, expected.split(','), name)
    assert.match(search, /WHERE @Search IS NOT NULL AND NOT EXISTS/)
    assert.match(search, /CHARINDEX\(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC\)>0/)
    assert.doesNotMatch(search, /\bLIKE\b|\bLOWER\b|CONCAT|REPLACE|LTRIM|RTRIM|TRIM|\bId\w+|r\.OrdenNivel|r\.Cantidad/)
    for (const col of actual.filter(x => /Costo|Precio|Subtotal|Total|Saldo|Impuesto|Horas/.test(x))) {
      assert.ok(values.includes(`CAST(r.${col} AS DECIMAL(38,2))`), `${name}.${col}`)
    }
    for (const col of actual.filter(x => x.startsWith('Fecha') && x !== 'FechaEstimada')) {
      assert.ok(values.includes(`CONVERT(NVARCHAR(19),r.${col},126)+N'.000Z'`), `${name}.${col}`)
    }
    assert.ok(sql.indexOf('INTO #Filas') < sql.indexOf('DELETE r'))
    assert.ok(sql.indexOf('DELETE r') < sql.indexOf('DECLARE @TotalRows'))
    assert.ok(sql.indexOf('DECLARE @TotalRows') < sql.indexOf('OFFSET @Offset'))
    assert.ok(sql.includes(`ORDER BY ${orders[name]} OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY`), name)
    if (name !== 'FacturasSaldo') {
      assert.match(sql, /DECLARE @TotalRows BIGINT=\(SELECT COUNT_BIG\(\*\) FROM #Filas\);/)
      assert.match(sql, /@MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710/)
    }
  }
  assert.match(reports.OrdenesActivas, /CONVERT\(NVARCHAR\(10\),r.FechaEstimada,23\)/)
})

test('limits sum every materialized resultset, and paginated invoices retain every payment of page parents only', () => {
  for (const [name, tables] of Object.entries({
    HistorialCliente: ['Cliente', 'Historial'], HistorialEquipo: ['Equipo', 'Historial'],
    Trazabilidad: ['Trazabilidad', 'Pagos', 'Estados'],
  })) {
    const expected = tables.map(table => `(SELECT COUNT_BIG(*) FROM #${table})`).join('+')
    assert.ok(reports[name].includes(`DECLARE @TotalRows BIGINT=${expected};`))
    assert.match(reports[name], /@TotalRows>@MaxRows THROW 51710/)
  }
  const sql = reports.FacturasSaldo
  assert.match(sql, /JOIN #Filas f ON f.IdFactura=p.IdFactura;/)
  assert.match(sql, /DECLARE @TotalRows BIGINT=\(SELECT COUNT_BIG\(\*\) FROM #Filas\);/)
  assert.match(sql, /DECLARE @TotalFilas BIGINT=@TotalRows\+\(SELECT COUNT_BIG\(\*\) FROM #Pagos\);/)
  assert.match(sql, /@TotalFilas>@MaxRows THROW 51710/)
  assert.match(sql, /FROM #Pagos p JOIN #Pagina f ON f.IdFactura=p.IdFactura ORDER BY p.IdFactura,p.FechaPago,p.IdPago;/)
  assert.equal((sql.match(/OFFSET @Offset/g) ?? []).length, 1)
  assert.ok(sql.indexOf('INTO #Pagos') < sql.indexOf('THROW 51710'))
  assert.ok(sql.indexOf('THROW 51710') < sql.indexOf('INTO #Pagina'))
  assert.match(reports.HistorialCliente, /LEFT JOIN dbo\.Equipo e ON e.IdCliente=c.IdCliente LEFT JOIN dbo\.OrdenServicio o ON o.IdEquipo=e.IdEquipo\s+AND \(@Desde/)
  assert.match(reports.HistorialEquipo, /FROM dbo\.fn_HistorialEquipo\(@NumeroSerie\)/)
})

test('migration is reproducible, exact phase definitions, guarded and atomic without GO', () => {
  assert.equal(migration, buildReportMigration(source))
  const embedded = [...migration.matchAll(/ EXEC\(N'((?:[^']|'')*)'\);/g)].map(m => m[1].replaceAll("''", "'"))
  assert.deepEqual(embedded, definitions)
  assert.doesNotMatch(migration, /^\s*GO\s*$/mi)
  assert.match(migration, /IF DB_NAME\(\)<>N'TechCareDB' THROW 51700/)
  assert.match(migration, /IF @@TRANCOUNT<>0 THROW 51700/)
  for (const token of ['BEGIN TRY', 'BEGIN TRANSACTION;', 'COMMIT TRANSACTION;', 'BEGIN CATCH', 'ROLLBACK TRANSACTION;']) {
    assert.equal(migration.split(token).length - 1, 1, token)
  }
  assert.match(migration, /IF XACT_STATE\(\)<>0 ROLLBACK TRANSACTION;\s+THROW;/)
  const firstExec = migration.indexOf(' EXEC(')
  for (const name of Object.keys(reports)) {
    const guard = `IF OBJECT_ID(N'dbo.usp_Reporte${name}',N'P') IS NULL THROW 51700`
    assert.ok(migration.indexOf(guard) > 0 && migration.indexOf(guard) < firstExec)
  }
  assert.throws(() => reportDefinitions(definitions.slice(1).join('\nGO\n')), /doce/)
  assert.throws(() => reportDefinitions(Array(12).fill(definitions[0]).join('\nGO\n')), /Nombres/)
})

test('generated master/local contain the exact reports phase', async () => {
  for (const name of ['TechCare_Master.sql', 'TechCare_Local.sql']) {
    const text = (await readFile(resolve(root, 'database', name), 'utf8')).replace(/\r\n/g, '\n')
    assert.ok(text.includes(source.replace(/\r\n/g, '\n').trimEnd()), name)
  }
})
