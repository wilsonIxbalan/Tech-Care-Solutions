import { inflateSync } from 'node:zlib';
import { invoicePdf } from '../../../src/modules/downloads/invoice-pdf';

// Extract PDFKit content streams for baseline checks, without another package.
function contentText(buffer: Buffer): string {
  const source = buffer.toString('latin1');
  const texts: string[] = [];
  const streams = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streams)) {
    const bytes = Buffer.from(match[2], 'latin1');
    const stream = (/\/FlateDecode/.test(match[1]) ? inflateSync(bytes) : bytes).toString('latin1');
    texts.push([...stream.matchAll(/<([\da-f]+)>/gi)].map((hex) => Buffer.from(hex[1], 'hex').toString('latin1')).join(''));
  }
  return texts.join('\n');
}

describe('Factura PDF simulada', () => {
  const invoice = {
    numeroFactura: 'F-0000007', numeroOrden: 'OT-001', fechaFactura: '2026-10-26T06:00:00.000Z', estado: 'EMITIDA',
    nitFacturacion: 'CF-0001', nombreFacturacion: 'Receptor persistido', direccionFacturacion: 'Dirección persistida, sin consultar cliente actual',
    subtotalManoObra: '0.00', subtotalRepuestos: '12.30', subtotal: '12.30', porcentajeImpuesto: '12.00', impuesto: '1.48',
    total: '999.09', totalPagado: '0.00', saldo: '-1.30', // Deliberately inconsistent: never recalculate.
    detalles: [{ tipoLinea: 'REPUESTO', descripcion: 'Detalle persistido', cantidad: '1.00', precioUnitario: '12.30', subtotal: '12.30' }],
    pagos: [{ idPago: 1, fechaPago: '2026-10-26T06:00:00.000Z', metodoPagoNombre: 'Efectivo', monto: '0.00', referencia: 'REF-001', estado: 'ANULADO', motivoAnulacion: 'Prueba sintética' }],
  };

  it('firma/trailer válidos, tamaño Carta y valores fiscales/monetarios persistidos sin recalcular', async () => {
    const pdf = await invoicePdf(invoice);
    const source = pdf.toString('latin1');
    expect(source.startsWith('%PDF-')).toBe(true);
    expect(source.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(source).toContain('/MediaBox [0 0 612 792]');
    const text = contentText(pdf);
    for (const expected of ['Tech Care Solutions', 'SIN VALIDEZ FISCAL', 'CF-0001', 'Receptor persistido', '999.09', '-1.30', '0.00', 'REF-001', 'ANULADO'])
      expect(text).toContain(expected);
    expect(source).not.toContain('/Subtype /Image');
  });

  it('tabla multipágina repite cabeceras y referencia, conserva última fila y descripción extensa', async () => {
    const pdf = await invoicePdf({
      ...invoice,
      detalles: Array.from({ length: 110 }, (_, index) => ({
        ...invoice.detalles[0],
        descripcion: index === 50 ? 'descripción '.repeat(500) + 'FIN-LARGA' : `Línea-${index}-persistida`,
      })),
    });
    const source = pdf.toString('latin1');
    const pageCount = [...source.matchAll(/\/Type \/Page\b/g)].length;
    expect(pageCount).toBeGreaterThan(3);
    const text = contentText(pdf);
    expect(text.split('Tech Care Solutions').length - 1).toBe(pageCount);
    expect(text.split('F-0000007').length - 1).toBe(pageCount);
    expect(text.split('Precio unitario').length - 1).toBeGreaterThan(3);
    expect(text).toContain('FIN-LARGA');
    expect(text).toContain('Línea-109-persistida');
    expect(text).toContain(`de ${pageCount}`);
  });
});
