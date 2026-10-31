import * as PDFDocument from 'pdfkit';
import { Row } from '../../database/database.service';
import { cellText } from './tabular-export';

type Invoice = Row & { detalles: Row[]; pagos: Row[] };
const NAVY = '#0B1628';
const TEAL = '#0F766E';
const LEFT = 44;
const WIDTH = 524;
const BOTTOM = 718;

function businessDate(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return cellText(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return cellText(value);
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala',
  }).format(date);
}

// No new invoice, tax calculation, disk files, remote images or issuer fiscal
// identity. Every displayed amount comes directly from the persisted snapshot.
export function invoicePdf(invoice: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 44, bottom: 44, left: LEFT, right: LEFT },
      bufferPages: true,
      info: { Title: 'Factura simulada - Tech Care Solutions', Author: 'Tech Care Solutions' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    let y = 0;
    let section = '';
    const reference = `Factura: ${cellText(invoice.numeroFactura)} | Orden: ${cellText(invoice.numeroOrden)}`;

    const text = (value: unknown, x: number, top: number, width: number, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(NAVY);
      doc.text(cellText(value), x, top, { width, lineBreak: false });
    };
    const header = () => {
      // Continuidad: misma geometria vectorial que el monograma T/C de la web.
      doc.save().translate(LEFT, 33).scale(0.34).lineWidth(12).lineCap('round').lineJoin('round');
      doc.path('M12 12h84m-42 0v68').stroke(TEAL);
      doc.path('M116 28c-26-27-60-9-60 24s34 49 60 24').stroke(TEAL);
      doc.restore();
      doc.font('Helvetica-Bold').fontSize(21).fillColor(TEAL)
        .text('Tech Care Solutions', LEFT + 55, 36, { width: WIDTH - 55 });
      text('FACTURA SIMULADA - SIN VALIDEZ FISCAL', LEFT, 65, WIDTH, true);
      text(reference, LEFT, 83, WIDTH);
      doc.moveTo(LEFT, 103).lineTo(LEFT + WIDTH, 103).strokeColor(TEAL).stroke();
      y = 116;
    };
    const widths = [62, 210, 62, 94, 96];
    const titles = ['Tipo', 'Descripción', 'Cantidad', 'Precio unitario', 'Subtotal'];
    const tableHeader = () => {
      doc.rect(LEFT, y, WIDTH, 22).fill(NAVY);
      let x = LEFT;
      titles.forEach((title, index) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
          .text(title, x + 5, y + 6, { width: widths[index] - 10, lineBreak: false });
        x += widths[index];
      });
      y += 28;
    };
    const nextPage = (table = false) => {
      doc.addPage();
      header();
      if (section) {
        text(`${section} (continuación)`, LEFT, y, WIDTH, true);
        y += 22;
      }
      if (table) tableHeader();
    };
    // Wrap even unbroken strings; no clipping of long descriptions or values.
    const wrap = (value: unknown, width: number): string[] => {
      doc.font('Helvetica').fontSize(9);
      const lines: string[] = [];
      for (const paragraph of cellText(value).replace(/\r\n?/g, '\n').split('\n')) {
        let line = '';
        for (const char of paragraph) {
          if (line && doc.widthOfString(line + char) > width) {
            lines.push(line);
            line = '';
          }
          line += char;
        }
        lines.push(line);
      }
      return lines;
    };
    const paragraph = (label: string, value: unknown) => {
      for (const line of wrap(`${label}: ${cellText(value)}`, WIDTH)) {
        if (y + 15 > BOTTOM) nextPage();
        text(line, LEFT, y, WIDTH);
        y += 14;
      }
      y += 4;
    };
    const heading = (title: string) => {
      section = '';
      if (y + 50 > BOTTOM) nextPage();
      section = title;
      text(title, LEFT, y, WIDTH, true);
      y += 22;
    };

    header();
    paragraph('Fecha (Guatemala)', businessDate(invoice.fechaFactura));
    paragraph('Estado', invoice.estado);
    heading('Datos de facturación');
    paragraph('NIT', invoice.nitFacturacion);
    paragraph('Nombre de facturación', invoice.nombreFacturacion);
    paragraph('Dirección de facturación', invoice.direccionFacturacion);
    heading('Detalle facturado');
    if (y + 55 > BOTTOM) nextPage();
    tableHeader();
    for (const item of invoice.detalles) {
      const values = [item.tipoLinea, item.descripcion, item.cantidad, item.precioUnitario, item.subtotal];
      const lines = values.map((value, index) => wrap(value, widths[index] - 10));
      const count = Math.max(...lines.map((column) => column.length));
      // Long rows can continue over pages; each page repeats reference/header.
      for (let index = 0; index < count; index++) {
        if (y + 16 > BOTTOM) nextPage(true);
        let x = LEFT;
        lines.forEach((column, columnIndex) => {
          text(column[index] ?? '', x + 5, y, widths[columnIndex] - 10);
          x += widths[columnIndex];
        });
        y += 14;
      }
      y += 7;
      doc.moveTo(LEFT, y - 3).lineTo(LEFT + WIDTH, y - 3).strokeColor('#D5E3E5').stroke();
    }
    if (!invoice.detalles.length) paragraph('Detalle', 'Sin líneas de facturación.');
    y += 10;
    heading('Resumen de la factura');
    for (const [label, key] of [
      ['Subtotal mano de obra (Q)', 'subtotalManoObra'],
      ['Subtotal repuestos (Q)', 'subtotalRepuestos'],
      ['Subtotal (Q)', 'subtotal'],
      ['Impuesto (%)', 'porcentajeImpuesto'],
      ['Impuesto (Q)', 'impuesto'],
      ['Total (Q)', 'total'],
      ['Pagado al consultar (Q)', 'totalPagado'],
      ['Saldo al consultar (Q)', 'saldo'],
    ]) paragraph(label, invoice[key]);
    heading('Pagos registrados');
    for (const payment of invoice.pagos) {
      paragraph('Pago / fecha (Guatemala) / estado', `${cellText(payment.idPago)} / ${businessDate(payment.fechaPago)} / ${cellText(payment.estado)}`);
      paragraph('Método / monto (Q)', `${cellText(payment.metodoPagoNombre)} / ${cellText(payment.monto)}`);
      paragraph('Referencia', payment.referencia);
      if (payment.motivoAnulacion) paragraph('Motivo de anulación', payment.motivoAnulacion);
    }
    if (!invoice.pagos.length) paragraph('Pagos', 'Sin pagos registrados.');
    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      doc.switchToPage(page);
      text(`Simulación sin validez fiscal | Página ${page + 1} de ${range.count}`, LEFT, 730, WIDTH);
    }
    doc.end();
  });
}
