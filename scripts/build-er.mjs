import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const outputPath = resolve(root, 'seguimiento/diseno/techcare-er.mmd');
const fail = (text) => { throw new Error(`ER: SQL no soportado o invalido: ${text}`); };
const id = '[A-Za-z_][A-Za-z_0-9]*';

// Small, deliberately closed SQL subset. Strings and nested parentheses are
// scanned before splitting; expressions are opaque, never evaluated as SQL.
function clean(sql) {
  let out = '';
  for (let i = 0; i < sql.length;) {
    if (sql[i] === "'") {
      const start = i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i++] === "'") {
          if (sql[i] === "'") i++;
          else { closed = true; break; }
        }
      }
      if (!closed) fail('literal sin cerrar');
      out += sql.slice(start, i);
    } else if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end;
      out += ' ';
    } else if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0 || sql.slice(i + 2, end).includes('/*')) fail('comentario sin cerrar o anidado');
      out += ' ';
      i = end + 2;
    } else out += sql[i++];
  }
  return out.replace(/^\s*GO\s*$/gmi, '').trim();
}

function split(text, separator) {
  let depth = 0, quoted = false, start = 0;
  const parts = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      if (quoted && text[i + 1] === "'") { i++; continue; }
      quoted = !quoted;
    }
    if (quoted) continue;
    if (ch === '(') depth++;
    if (ch === ')' && --depth < 0) fail('parentesis inesperado');
    if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i).trim()); start = i + 1;
    }
  }
  if (depth || quoted) fail('parentesis o literal sin cerrar');
  if (text.slice(start).trim()) parts.push(text.slice(start).trim());
  return parts;
}

function expression(text) {
  if (!text.startsWith('(')) fail(text);
  let depth = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") {
      if (quoted && text[i + 1] === "'") { i++; continue; }
      quoted = !quoted;
    }
    if (quoted) continue;
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return [text.slice(1, i), text.slice(i + 1).trim()];
  }
  return fail(text);
}

function names(text) {
  const result = split(text, ',');
  if (!result.length || result.some((name) => !new RegExp(`^${id}$`).test(name)) || new Set(result).size !== result.length) fail(text);
  return result;
}

function parseTable(name, body) {
  const table = { name, columns: [], keys: [] };
  for (const item of split(body, ',')) {
    const constraint = item.match(new RegExp(`^CONSTRAINT (${id}) (PRIMARY KEY|UNIQUE|CHECK)\\s*(.*)$`, 'is'));
    if (constraint) {
      const [, keyName, kind, rest] = constraint;
      const [value, tail] = expression(rest);
      if (tail) fail(item);
      if (kind.toUpperCase() !== 'CHECK') table.keys.push({ name: keyName, kind: kind.toUpperCase(), columns: names(value), filter: null });
      continue;
    }
    const column = item.match(new RegExp(`^(${id})\\s+(.+)$`, 's'));
    if (!column) fail(item);
    const [, columnName, definition] = column;
    if (/^AS\s/i.test(definition)) {
      const [computed, tail] = expression(definition.replace(/^AS\s+/i, ''));
      if (tail) fail(item);
      table.columns.push({ name: columnName, type: 'computed', nullable: null, computed });
      continue;
    }
    const typed = definition.match(/^(INT|BIGINT|TINYINT|BIT|DATE|SYSNAME|VARCHAR\(\d+\)|CHAR\(\d+\)|DATETIME2\(\d+\)|DECIMAL\(\d+,\s*\d+\))\s+(.*)$/is);
    if (!typed) fail(item);
    let rest = typed[2].replace(/^IDENTITY\s+/i, '');
    const nullability = rest.match(/^(NOT NULL|NULL)\b\s*/i);
    if (!nullability) fail(`nullability explicita requerida: ${item}`);
    rest = rest.slice(nullability[0].length);
    table.columns.push({ name: columnName, type: typed[1].toUpperCase().replace(/\s/g, ''), nullable: nullability[1].toUpperCase() === 'NULL' });
    while (rest) {
      const modifier = rest.match(new RegExp(`^(?:CONSTRAINT (${id}) )?(PRIMARY KEY|UNIQUE|DEFAULT|CHECK)\\b\\s*(.*)$`, 'is'));
      if (!modifier) fail(item);
      const [, keyName, rawKind, tail] = modifier;
      const kind = rawKind.toUpperCase();
      if (kind === 'DEFAULT' || kind === 'CHECK') [, rest] = expression(tail);
      else {
        table.keys.push({ name: keyName ?? `${kind}_${columnName}`, kind, columns: [columnName], filter: null });
        rest = tail;
      }
    }
  }
  if (new Set(table.columns.map((c) => c.name.toLowerCase())).size !== table.columns.length) fail(`columnas duplicadas: ${name}`);
  return table;
}

const wrapper = /^(?:SET (?:ANSI_NULLS|QUOTED_IDENTIFIER|ANSI_PADDING|ANSI_WARNINGS|ARITHABORT|CONCAT_NULL_YIELDS_NULL|NUMERIC_ROUNDABORT|XACT_ABORT) (?:ON|OFF)|BEGIN TRANSACTION|COMMIT TRANSACTION)$/i;

export function parseSchema(tablesSql, relationsSql, indexesSql) {
  const tables = [], relations = [];
  for (const statement of split(clean(tablesSql), ';')) {
    if (wrapper.test(statement)) continue;
    if (/^IF DB_NAME\(\) IN \(N'master', N'model', N'msdb', N'tempdb'\)\s+THROW 50090, N'[^']*', 1$/i.test(statement)) continue;
    if (/^IF EXISTS \(SELECT 1 FROM sys.tables WHERE is_ms_shipped = 0\)\s+THROW 50091, N'[^']*', 1$/i.test(statement)) continue;
    const match = statement.match(new RegExp(`^CREATE TABLE dbo\\.(${id})\\s*\\(([\\s\\S]*)\\)$`, 'i'));
    if (!match) fail(statement);
    tables.push(parseTable(match[1], match[2]));
  }
  if (!tables.length || new Set(tables.map((t) => t.name.toLowerCase())).size !== tables.length) fail('tablas ausentes o duplicadas');
  const getTable = (name) => tables.find((t) => t.name === name) ?? fail(`tabla desconocida: ${name}`);
  const validateColumns = (table, columns) => columns.forEach((name) => {
    if (!table.columns.some((c) => c.name === name && !c.computed)) fail(`columna desconocida o computada: ${table.name}.${name}`);
  });
  for (const statement of split(clean(relationsSql), ';')) {
    if (wrapper.test(statement)) continue;
    const match = statement.match(new RegExp(`^ALTER TABLE dbo\\.(${id}) ADD CONSTRAINT (${id}) FOREIGN KEY\\s*\\(([^)]+)\\) REFERENCES dbo\\.(${id})\\s*\\(([^)]+)\\)(?: ON DELETE (CASCADE|NO ACTION))?$`, 'i'));
    if (!match) fail(statement);
    const [, child, name, childColumns, parent, parentColumns, onDelete] = match;
    const columns = names(childColumns), references = names(parentColumns);
    validateColumns(getTable(child), columns);
    validateColumns(getTable(parent), references);
    if (columns.length !== references.length || relations.some((r) => r.name === name)) fail(statement);
    relations.push({ name, child, parent, columns, references, onDelete: onDelete ?? 'NO ACTION' });
  }
  for (const statement of split(clean(indexesSql), ';')) {
    const match = statement.match(new RegExp(`^CREATE (UNIQUE )?NONCLUSTERED INDEX (${id}) ON dbo\\.(${id})\\(([^)]+)\\)(?: INCLUDE \\(([^)]+)\\))?(?: WHERE (.+))?$`, 'is'));
    if (match) {
      const [, unique, name, tableName, rawColumns, include, rawFilter] = match;
      const table = getTable(tableName);
      const columns = names(rawColumns.replace(/\s+(ASC|DESC)\b/gi, ''));
      validateColumns(table, columns);
      if (include) validateColumns(table, names(include));
      let filter = null;
      if (rawFilter) {
        filter = rawFilter.trim().replace(/\s+/g, ' ');
        const predicate = filter.match(new RegExp(`^(${id}) (?:IS (?:NOT )?NULL|(?:=|<>) '[^']*')$`, 'i'));
        if (!predicate) fail(`filtro: ${rawFilter}`);
        validateColumns(table, [predicate[1]]);
      }
      if (unique) table.keys.push({ name, kind: 'UNIQUE', columns, filter });
      continue;
    }
    // These phase-03 objects do not define persisted entities or relationships.
    if (new RegExp(`^CREATE SEQUENCE dbo\\.${id} AS BIGINT START WITH \\d+ INCREMENT BY \\d+ MAXVALUE \\d+ NO CYCLE$`, 'i').test(statement)) continue;
    const type = statement.match(new RegExp(`^CREATE TYPE dbo\\.(${id}) AS TABLE \\(([\\s\\S]*)\\)$`, 'i'));
    if (type) { parseTable(type[1], type[2]); continue; }
    if (wrapper.test(statement)) continue;
    fail(statement);
  }
  for (const table of tables) {
    if (table.keys.filter((k) => k.kind === 'PRIMARY KEY').length !== 1) fail(`PK unica requerida: ${table.name}`);
    for (const key of table.keys) validateColumns(table, key.columns);
    const pk = table.keys.find((k) => k.kind === 'PRIMARY KEY');
    if (pk.columns.some((name) => table.columns.find((c) => c.name === name).nullable)) fail(`PK nullable: ${table.name}`);
  }
  for (const relation of relations) {
    if (!getTable(relation.parent).keys.some((k) => !k.filter && sameSet(k.columns, relation.references))) fail(`FK sin clave candidata: ${relation.name}`);
  }
  return { tables, relations };
}

function sameSet(a, b) { return a.length === b.length && a.every((name) => b.includes(name)); }

export function renderEr(schema) {
  const lines = [
    '%% Generado por node scripts/build-er.mjs; no editar manualmente.',
    '%% Fuentes: database/fases/01_tablas.sql, 02_relaciones.sql, 03_indices_secuencias_tipos.sql.',
    '%% PK/UK compuestas: las marcas son miembros de una clave, no unicidad individual; ver grupos.',
    '%% UNIQUE filtrado se documenta como grupo, sin marca UK global.',
    '%% Cardinalidades estructurales: NULL permite cero padres; todo padre permite cero hijos.',
    '%% CHECK, triggers y reglas de negocio no aumentan los minimos; expresiones AS no inferidas.',
    '%% Linea solida: FK incluida en PK hija; punteada: relacion no identificadora.',
    '%% Tipos DECIMAL(p,s) se escriben DECIMAL_p_s para compatibilidad Mermaid.',
    'erDiagram',
  ];
  for (const table of schema.tables) {
    lines.push(`    ${table.name} {`);
    for (const key of table.keys) lines.push(`        %% ${key.kind} ${key.name} (${key.columns.join(', ')})${key.filter ? ` WHERE ${key.filter}` : ''}`);
    for (const col of table.columns) {
      const tags = [];
      if (table.keys.some((k) => k.kind === 'PRIMARY KEY' && k.columns.includes(col.name))) tags.push('PK');
      if (schema.relations.some((r) => r.child === table.name && r.columns.includes(col.name))) tags.push('FK');
      if (table.keys.some((k) => k.kind === 'UNIQUE' && !k.filter && k.columns.includes(col.name))) tags.push('UK');
      if (col.computed) lines.push(`        %% ${col.name} AS (${col.computed.replace(/\s+/g, ' ')})`);
      const type = col.type.replace(/DECIMAL\((\d+),(\d+)\)/, 'DECIMAL_$1_$2');
      lines.push(`        ${type} ${col.name}${tags.length ? ` ${tags.join(',')}` : ''} "${col.computed ? 'COMPUTADA; tipo y nullability no inferidos' : col.nullable ? 'NULL' : 'NOT NULL'}"`);
    }
    lines.push('    }');
  }
  lines.push('');
  for (const rel of schema.relations) {
    const child = schema.tables.find((t) => t.name === rel.child);
    const optional = rel.columns.some((name) => child.columns.find((c) => c.name === name).nullable);
    // A key contained in the FK bounds matching children. IS NOT NULL only
    // excludes rows that could not participate in this relationship anyway.
    const unique = child.keys.some((k) => k.columns.every((name) => rel.columns.includes(name)) &&
      (!k.filter || rel.columns.some((name) => k.filter.toUpperCase() === `${name} IS NOT NULL`.toUpperCase())));
    const identifying = rel.columns.every((name) => child.keys.find((k) => k.kind === 'PRIMARY KEY').columns.includes(name));
    lines.push(`    %% ${rel.name}: (${rel.columns.join(', ')}) -> (${rel.references.join(', ')}); ON DELETE ${rel.onDelete}`);
    lines.push(`    ${rel.parent} ${optional ? '|o' : '||'}${identifying ? '--' : '..'}${unique ? 'o|' : 'o{'} ${rel.child} : "${rel.name}"`);
  }
  return `${lines.join('\n')}\n`;
}

export async function loadSchema() {
  const sql = await Promise.all(['01_tablas.sql', '02_relaciones.sql', '03_indices_secuencias_tipos.sql'].map((file) => readFile(resolve(root, 'database/fases', file), 'utf8')));
  return parseSchema(...sql);
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--check')) fail('uso: node scripts/build-er.mjs [--check]');
  const schema = await loadSchema();
  const expected = renderEr(schema);
  if (process.argv.includes('--check')) {
    const actual = await readFile(outputPath, 'utf8');
    if (actual !== expected) throw new Error('ER desactualizado: ejecutar node scripts/build-er.mjs');
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, expected, 'utf8');
  }
  console.log(`ER ${process.argv.includes('--check') ? 'verificado' : 'generado'}: ${schema.tables.length} tablas, ${schema.relations.length} FK.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
