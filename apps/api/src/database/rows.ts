import { Row } from './database.service';
const decimalFields =
  /^(Costo|Precio|Subtotal|Total|Saldo|Impuesto|Monto|Porcentaje|Horas)/;
export function camel(name: string) {
  return name
    .replace(/^[A-Z]+(?=[A-Z][a-z]|$)/, (prefix) => prefix.toLowerCase())
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase());
}
export function publicRow(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row)
      .filter(
        ([key]) =>
          !['PasswordHash', 'IntentosFallidos', 'TotalRows'].includes(key),
      )
      .map(([key, value]) => {
        const decimal =
          decimalFields.test(key) || (key === 'Cantidad' && 'TipoLinea' in row);
        return [
          camel(key),
          value instanceof Date
            ? key === 'FechaEstimada'
              ? value.toISOString().slice(0, 10)
              : value.toISOString()
            : decimal && typeof value === 'number'
              ? value.toFixed(2)
              : value,
        ];
      }),
  );
}
export const publicRows = (rows: Row[]) => rows.map(publicRow);
export function pagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
