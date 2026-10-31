import { Injectable } from '@nestjs/common';
import { ApiError, invalid, notFound } from '../../common/api-error';
import { Row } from '../../database/database.service';
import { ReadRepository } from '../../database/read.repository';
import { publicRows } from '../../database/rows';
import { ReportsRepository } from '../reports/reports.repository';
import { ReportExportQuery } from './downloads.dto';
import { invoicePdf } from './invoice-pdf';
import { csvBuffer, ExportSet, xlsxBuffer } from './tabular-export';

export const MAX_EXPORT_ROWS = 10000;

const sheetNames: Record<string, readonly string[]> = {
  'ordenes-activas': ['Órdenes activas'],
  'historial-cliente': ['Cliente', 'Historial de servicios'],
  'historial-equipo': ['Equipo', 'Historial de servicios'],
  'actividad-tecnico': ['Actividad del técnico'],
  'repuestos-utilizados': ['Repuestos utilizados'],
  inventario: ['Inventario'],
  'bajo-minimo': ['Bajo mínimo'],
  'compras-proveedor': ['Compras por proveedor'],
  movimientos: ['Movimientos'],
  'facturas-saldo': ['Facturas y saldos', 'Pagos'],
  ingresos: ['Ingresos facturados'],
  trazabilidad: ['Servicio y documentos', 'Pagos', 'Historial de estados'],
};

export interface Download {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

@Injectable()
export class DownloadsService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly reads: ReadRepository,
  ) {}

  async report(slug: string, query: ReportExportQuery): Promise<Download> {
    // Do not pass export-only keys: execute validates Object.keys per report.
    const { formato, conjunto, ...filters } = query;
    if (formato === 'csv' && conjunto === undefined)
      throw invalid('conjunto', 'Selecciona el conjunto (1 a N) para el CSV.');
    if (formato === 'xlsx' && conjunto !== undefined)
      throw invalid('conjunto', 'XLSX incluye todos los conjuntos; omite conjunto.');
    const rawSets = await this.reports.exportRows(slug, filters, MAX_EXPORT_ROWS);
    if (
      (slug === 'historial-cliente' || slug === 'historial-equipo') &&
      !rawSets[0]?.length
    )
      throw notFound();
    // Defensa adicional ante contratos incorrectos; SQL ya aplica search y el
    // limite global ANTES de transferir filas, incluidos pagos e historiales.
    const total = rawSets.reduce((count, set) => count + set.length, 0);
    if (total > MAX_EXPORT_ROWS)
      throw new ApiError(
        413,
        'EXPORTACION_DEMASIADO_GRANDE',
        'La exportación supera 10000 filas en total. Ajusta los filtros; no se ha truncado ningún conjunto.',
      );
    const sets: ExportSet[] = rawSets.map((raw, index) => {
      const rows = publicRows(raw);
      // mssql preserves column metadata even for an empty resultset.
      const metadata = (raw as Row[] & { columns?: Record<string, unknown> }).columns;
      const emptyHeader = metadata
        ? publicRows([Object.fromEntries(Object.keys(metadata).map((key) => [key, null]))])[0]
        : {};
      return {
        name: sheetNames[slug]?.[index] ?? `Conjunto ${index + 1}`,
        columns: [...new Set([...Object.keys(emptyHeader), ...rows.flatMap(Object.keys)])],
        rows,
      };
    });
    const basename = slug.replace(/[^a-z0-9-]/gi, '-');
    if (formato === 'csv') {
      const set = sets[(conjunto ?? 0) - 1];
      if (!set) throw invalid('conjunto', `Selecciona un conjunto entre 1 y ${sets.length}.`);
      return {
        buffer: csvBuffer(set),
        contentType: 'text/csv; charset=utf-8',
        filename: `${basename}-conjunto-${conjunto}.csv`,
      };
    }
    return {
      buffer: await xlsxBuffer(sets),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${basename}.xlsx`,
    };
  }

  async invoice(id: number): Promise<Download> {
    const invoice = await this.reads.invoiceDetail(id);
    return {
      buffer: await invoicePdf(invoice),
      contentType: 'application/pdf',
      filename: `factura-simulada-${id}.pdf`,
    };
  }
}
