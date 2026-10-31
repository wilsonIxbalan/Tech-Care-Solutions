import { CellValue, Workbook } from 'exceljs';
import { csvBuffer, xlsxBuffer } from '../../../src/modules/downloads/tabular-export';

// RFC4180 parser for assertions, including embedded CR/LF and doubled quotes.
function parseCsv(buffer: Buffer): string[][] {
  const input = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(cell);
      cell = '';
    } else if (!quoted && char === '\r' && input[index + 1] === '\n') {
      rows.push([...row, cell]);
      row = [];
      cell = '';
      index++;
    } else cell += char;
  }
  return rows;
}

describe('tabular downloads', () => {
  it('CSV UTF8 BOM conserva Unicode, comas, comillas, CRLF, ceros y decimales', () => {
    const buffer = csvBuffer({
      columns: ['id', 'nombre', 'total', 'fecha', 'nulo'],
      rows: [{ id: '000000123456789012345', nombre: 'José, "técnico"\r\nsegunda línea', total: '0.00', fecha: '2026-10-26T06:00:00.000Z', nulo: null }],
    });
    expect(buffer.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(parseCsv(buffer)[1]).toEqual(['000000123456789012345', 'José, "técnico"\r\nsegunda línea', '0.00', '2026-10-26T00:00:00.000-06:00', '']);
  });

  it.each(['=SUM(1,2)', '+cmd', '-2+3', '@SUM(1)', '\t=1', '\r=2', '\n=3', '  \t@SUM(1)', '   =HYPERLINK("https://example.invalid")', '\uFEFF=2', '\u0000=2', '\u200E=2'])('neutraliza fórmula textual %j', (hostile) => {
    const buffer = csvBuffer({ columns: ['descripcion'], rows: [{ descripcion: hostile }] });
    expect(parseCsv(buffer)[1][0]).toBe(`'${hostile}`);
  });

  it('no neutraliza negativos oficiales seguros, pero sí expresiones en columnas monetarias', () => {
    const buffer = csvBuffer({
      columns: ['saldo', 'monto', 'descripcion', 'total'],
      rows: [{ saldo: '-12.30', monto: '-0.00', descripcion: '-12.30', total: '-2+3' }],
    });
    expect(parseCsv(buffer)[1]).toEqual(['-12.30', '-0.00', "'-12.30", "'-2+3"]);
  });

  it('también protege encabezados hostiles', () => {
    expect(parseCsv(csvBuffer({ columns: ['=1'], rows: [] }))[0]).toEqual(["'=1"]);
  });

  it('XLSX roundtrip usa varias hojas, Arial, filtros y texto sin fórmulas', async () => {
    const values = ['000012345678901234567890', '0.00', '-12.30', '2026-10-26T06:00:00.000Z', '=1+1', '\t@SUM(1)'];
    const columns = values.map((_, index) => `campo${index}`);
    const buffer = await xlsxBuffer([
      { columns, rows: [Object.fromEntries(columns.map((key, index) => [key, values[index]]))] },
      { columns: ['idPago'], rows: [{ idPago: 42 }] },
      { columns: ['sinDatos'], rows: [] },
    ]);
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Conjunto 1', 'Conjunto 2', 'Conjunto 3']);
    const sheet = workbook.worksheets[0];
    expect((sheet.getRow(2).values as CellValue[]).slice(1)).toEqual(values);
    expect(sheet.getCell('A1').font).toMatchObject({ name: 'Arial', bold: true });
    expect(sheet.getCell('E2').type).toBe(3); // ExcelJS String, never Formula (6).
    expect(sheet.getCell('A2').numFmt).toBe('@');
    expect(sheet.autoFilter).toBe('A1:F2');
    expect(workbook.worksheets[1].getCell('A2').value).toBe('42');
    expect(workbook.worksheets[2].getCell('A1').value).toBe('sinDatos');
  });
});
