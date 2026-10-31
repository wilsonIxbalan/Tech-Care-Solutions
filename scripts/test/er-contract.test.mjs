import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadSchema, outputPath, parseSchema, renderEr } from '../build-er.mjs';

const schema = await loadSchema();
const diagram = renderEr(schema);
const table = (name) => schema.tables.find((t) => t.name === name);
const relationLine = (name) => diagram.split('\n').find((line) => line.endsWith(`: "${name}"`));

test('contrato persistido: 33 tablas, 52 FK y siete UNIQUE filtrados', async () => {
  assert.equal(schema.tables.length, 33);
  assert.equal(schema.relations.length, 52);
  assert.equal(schema.tables.flatMap((t) => t.keys).filter((k) => k.filter).length, 7);
  assert.equal(await readFile(outputPath, 'utf8'), diagram);
  assert.equal(renderEr(await loadSchema()), diagram);
  assert.equal((diagram.match(/^    \w+ \{$/gm) ?? []).length, 33);
  for (const t of schema.tables) {
    for (const c of t.columns) assert.ok(diagram.includes(` ${c.name} `), `${t.name}.${c.name}`);
  }
});

test('PK y FK compuestas mantienen sus grupos', () => {
  for (const [name, columns] of [
    ['RolPermiso', ['IdRol', 'IdPermiso']],
    ['UsuarioRol', ['IdUsuario', 'IdRol']],
    ['TransicionEstadoOrden', ['IdEstadoOrigen', 'IdEstadoDestino']],
    ['InventarioBodega', ['IdBodega', 'IdRepuesto']],
  ]) assert.deepEqual(table(name).keys.find((k) => k.kind === 'PRIMARY KEY').columns, columns);
  assert.deepEqual(schema.relations.find((r) => r.name === 'FK_Consumo_Inventario').columns, ['IdBodega', 'IdRepuesto']);
  assert.match(diagram, /INT IdBodega PK,FK "NOT NULL"/);
  assert.match(relationLine('FK_RolPermiso_Rol'), /Rol \|\|--o\{ RolPermiso/);
  assert.deepEqual(table('DetalleCompra').keys.find((k) => k.kind === 'UNIQUE').columns, ['IdCompra', 'IdRepuesto']);
  assert.match(relationLine('FK_DetalleCompra_Compra'), /\|\|\.\.o\{/);
});

test('cardinalidad por nullability y unicidad, sin generalizar filtros', () => {
  assert.match(relationLine('FK_Factura_Orden'), /OrdenServicio \|\|\.\.o\| Factura/);
  assert.match(relationLine('FK_Entrega_Orden'), /\|\|\.\.o\|/);
  assert.match(relationLine('FK_Compra_Recepcion'), /Usuario \|o\.\.o\{ Compra/);
  assert.match(relationLine('FK_Historial_Anterior'), /EstadoOrden \|o\.\.o\{/);
  assert.match(relationLine('FK_Movimiento_Compra'), /DetalleCompra \|o\.\.o\| MovimientoInventario/);
  assert.match(relationLine('FK_Movimiento_Consumo'), /\|o\.\.o\|/);
  assert.match(relationLine('FK_Diagnostico_Orden'), /\|\|\.\.o\{/);
  assert.match(relationLine('FK_Historial_Orden'), /\|\|\.\.o\{/);
  assert.match(relationLine('FK_DetalleFactura_Reparacion'), /\|o\.\.o\{/);
  assert.match(diagram, /UNIQUE UX_Diagnostico_Activo \(IdOrden\) WHERE Estado = 'ACTIVO'/);
});

test('cliente de orden se deriva de Equipo; computadas son proyecciones', () => {
  assert.ok(!table('OrdenServicio').columns.some((c) => c.name === 'IdCliente'));
  assert.ok(!schema.relations.some((r) => r.child === 'OrdenServicio' && r.parent === 'Cliente'));
  assert.match(relationLine('FK_Orden_Equipo'), /Equipo \|\|\.\.o\{ OrdenServicio/);
  assert.equal(schema.tables.flatMap((t) => t.columns).filter((c) => c.computed).length, 7);
  assert.match(diagram, /computed Total "COMPUTADA; tipo y nullability no inferidos"/);
  assert.match(diagram, /%% NombreMostrar AS \(CASE WHEN/);
});

const basic = `CREATE TABLE dbo.Parent (Id INT NOT NULL CONSTRAINT PK_P PRIMARY KEY);
CREATE TABLE dbo.Child (Id INT NOT NULL CONSTRAINT PK_C PRIMARY KEY, ParentId INT NULL, Text VARCHAR(80) NOT NULL DEFAULT ('a,b; -- /* ''x'), Amount DECIMAL(12,2) NOT NULL);`;
const fk = 'ALTER TABLE dbo.Child ADD CONSTRAINT FK_C FOREIGN KEY (ParentId) REFERENCES dbo.Parent(Id);';

test('scanner respeta literales, comas y parentesis; FK unica opcional', () => {
  const model = parseSchema(basic, fk, 'CREATE UNIQUE NONCLUSTERED INDEX UX_C ON dbo.Child(ParentId) WHERE ParentId IS NOT NULL;');
  assert.equal(model.tables[1].columns.length, 4);
  assert.match(renderEr(model), /Parent \|o\.\.o\| Child/);
});

test('falla explicitamente ante sintaxis, referencias o filtros no soportados', () => {
  for (const args of [
    [basic + ' ALTER TABLE dbo.Child ADD Other INT NULL;', fk, ''],
    [basic.replace('Amount DECIMAL(12,2)', 'Amount MONEY'), fk, ''],
    [basic.replace('ParentId INT NULL', 'ParentId INT'), fk, ''],
    [basic.replace('ParentId INT NULL', 'ParentId INT NULL REFERENCES dbo.Parent(Id)'), fk, ''],
    [basic, fk.replace('(ParentId)', '(Missing)'), ''],
    [basic, fk + ' ALTER TABLE dbo.Child NOCHECK CONSTRAINT FK_C;', ''],
    [basic, fk, "CREATE UNIQUE NONCLUSTERED INDEX UX_C ON dbo.Child(ParentId) WHERE ParentId > 0;"],
    [basic, fk, 'CREATE UNIQUE CLUSTERED INDEX UX_C ON dbo.Child(ParentId);'],
    [basic.replace('Id INT NOT NULL CONSTRAINT PK_P', 'Id INT NULL CONSTRAINT PK_P'), fk, ''],
    [basic + ' /* unclosed', fk, ''],
    [basic.replace("'a,b; -- /* ''x'", "'unterminated"), fk, ''],
    [basic, fk.replace('dbo.Parent(Id)', 'dbo.Child(Amount)'), ''],
  ]) assert.throws(() => parseSchema(...args), /ER: SQL no soportado o invalido/);
});

test('--check funciona desde otro directorio y rechaza argumentos desconocidos', () => {
  const script = fileURLToPath(new URL('../build-er.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('../../seguimiento', import.meta.url));
  const checked = spawnSync(process.execPath, [script, '--check'], { cwd, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  const invalid = spawnSync(process.execPath, [script, '--unknown'], { cwd, encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /uso:/);
});
