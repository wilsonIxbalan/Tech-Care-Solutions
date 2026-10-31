import { Workbook } from 'exceljs';
import { Row } from '../../database/database.service';
import { guatemalaInstant } from '../../common/business-time';

export interface ExportSet {
  name?: string;
  columns: string[];
  rows: Row[];
}

// Decimal strings and identifiers stay text: Excel must not round/reinterpret
// persisted amounts, leading zeroes, long IDs or ISO dates.
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return guatemalaInstant(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function exportCell(value: unknown, column: string): string {
  if (/^fecha/i.test(column) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const instant = new Date(value);
    if (!Number.isNaN(instant.getTime())) return guatemalaInstant(instant);
  }
  return cellText(value);
}

function csvCell(value: unknown, column: string): string {
  let text = exportCell(value, column);
  const officialNumber =
    /^(?:costo|precio|subtotal|total|saldo|impuesto|monto|porcentaje|horas|cantidad)/i.test(
      column,
    ) && /^-?\d+(?:\.\d+)?$/.test(text);
  // Quoting alone does not prevent spreadsheet formula execution. Inspect past
  // whitespace, including tabs/CR, without modifying safe official decimals.
  if (!officialNumber && /^[\s\p{Cc}\p{Cf}]*[=+\-@\t\r\n]/u.test(text))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvBuffer(set: ExportSet): Buffer {
  const lines = [
    set.columns.map((column) => csvCell(column, '')).join(','),
    ...set.rows.map((row) =>
      set.columns.map((column) => csvCell(row[column], column)).join(','),
    ),
  ];
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

export async function xlsxBuffer(sets: ExportSet[]): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = 'Tech Care Solutions';
  sets.forEach((set, index) => {
    const sheet = workbook.addWorksheet(set.name ?? `Conjunto ${index + 1}`, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = set.columns.map((key) => ({ key, width: 24 }));
    sheet.addRow(set.columns);
    for (const row of set.rows)
      sheet.addRow(set.columns.map((column) => exportCell(row[column], column)));
    sheet.eachRow((row, rowNumber) => {
      row.font = { name: 'Arial', size: 10, bold: rowNumber === 1 };
      row.eachCell((cell) => {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'top', wrapText: true };
        if (rowNumber === 1) {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1628' } };
        }
      });
    });
    if (set.columns.length)
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, sheet.rowCount), column: set.columns.length },
      };
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
