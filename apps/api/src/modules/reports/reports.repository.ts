import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { ApiError, invalid, notFound } from '../../common/api-error';
import { databaseDiagnostics } from '../../database/database-diagnostics';
import { guatemalaYearMonth } from '../../common/business-time';
import { dateRange, orderStates, ReportQuery } from '../../common/query.dto';
import {
  DatabaseService,
  int,
  Param,
  param,
  Row,
  text,
} from '../../database/database.service';

export const reports = {
  'ordenes-activas': {
    procedure: 'usp_ReporteOrdenesActivas',
    keys: ['estado', 'idPrioridad', 'idTecnico', 'fechaDesde', 'fechaHasta'],
  },
  'historial-cliente': {
    procedure: 'usp_ReporteHistorialCliente',
    keys: ['idCliente', 'fechaDesde', 'fechaHasta'],
  },
  'historial-equipo': {
    procedure: 'usp_ReporteHistorialEquipo',
    keys: ['numeroSerie'],
  },
  'actividad-tecnico': {
    procedure: 'usp_ReporteActividadTecnico',
    keys: ['idTecnico', 'fechaDesde', 'fechaHasta'],
  },
  'repuestos-utilizados': {
    procedure: 'usp_ReporteRepuestosUtilizados',
    keys: ['idOrden', 'idTecnico', 'idBodega', 'fechaDesde', 'fechaHasta'],
  },
  inventario: {
    procedure: 'usp_ReporteInventario',
    keys: ['idBodega', 'idCategoria', 'idRepuesto'],
  },
  'bajo-minimo': {
    procedure: 'usp_ReporteBajoMinimo',
    keys: ['idBodega', 'idCategoria'],
  },
  'compras-proveedor': {
    procedure: 'usp_ReporteComprasProveedor',
    keys: ['idProveedor', 'idBodega', 'estado', 'fechaDesde', 'fechaHasta'],
  },
  movimientos: {
    procedure: 'usp_ReporteMovimientos',
    keys: [
      'idBodega',
      'idRepuesto',
      'codigoTipoMovimiento',
      'idUsuario',
      'fechaDesde',
      'fechaHasta',
    ],
  },
  'facturas-saldo': {
    procedure: 'usp_ReporteFacturasSaldo',
    keys: ['idCliente', 'conSaldo', 'estado', 'fechaDesde', 'fechaHasta'],
  },
  ingresos: {
    procedure: 'usp_ReporteIngresos',
    keys: ['idCliente', 'fechaDesde', 'fechaHasta'],
  },
  trazabilidad: { procedure: 'usp_ReporteTrazabilidad', keys: ['idOrden'] },
} as const;
export const completeReports = new Set(['historial-cliente', 'historial-equipo', 'trazabilidad']);

interface IngresoMes {
  Anio: number; Mes: number; CantidadFacturas: number;
  TotalManoObra: bigint; TotalRepuestos: bigint; Subtotal: bigint; Impuesto: bigint; Total: bigint;
}
/** DECIMAL(12,2) llega como number o string: pasa a centavos enteros para sumar sin error de coma flotante. */
function toCents(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  return BigInt(Math.round(Number(value) * 100));
}
/** Texto equivalente a CAST(x AS DECIMAL(38,2)) del SP, para la búsqueda. */
function centsText(cents: bigint): string {
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}
export function aggregateIngresos(invoices: Row[]): IngresoMes[] {
  const months = new Map<number, IngresoMes>();
  for (const invoice of invoices) {
    const { anio, mes } = guatemalaYearMonth(new Date(invoice.FechaFactura as Date));
    const key = anio * 12 + mes;
    let m = months.get(key);
    if (!m) {
      m = { Anio: anio, Mes: mes, CantidadFacturas: 0, TotalManoObra: 0n, TotalRepuestos: 0n, Subtotal: 0n, Impuesto: 0n, Total: 0n };
      months.set(key, m);
    }
    m.CantidadFacturas += 1;
    m.TotalManoObra += toCents(invoice.SubtotalManoObra);
    m.TotalRepuestos += toCents(invoice.SubtotalRepuestos);
    m.Subtotal += toCents(invoice.Subtotal);
    m.Impuesto += toCents(invoice.Impuesto);
    m.Total += toCents(invoice.Total);
  }
  return [...months.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m);
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly db: DatabaseService) {}
  async execute(slug: string, query: ReportQuery) {
    return this.run(slug, query);
  }
  async paged(slug: string, query: ReportQuery) {
    if (completeReports.has(slug)) throw invalid('page', 'Este reporte conserva todas sus relaciones.');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    if (!Number.isInteger(page) || page < 1 || page > 2147483647
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw invalid('page', 'La página o su tamaño no son válidos.');
    const result = await this.run(slug, query, [int('Page', page), int('PageSize', pageSize)]);
    const metadata = result[result.length - 1];
    const sets = result.slice(0, -1);
    const value = metadata?.[0]?.TotalRows;
    const total = typeof value === 'number' ? value
      : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
    const expectedSets = slug === 'facturas-saldo' ? 2 : 1;
    if (!metadata || metadata.length !== 1 || !Number.isSafeInteger(total) || total < 0 || sets.length !== expectedSets)
      throw new ApiError(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo verificar la paginación del reporte.');
    return { sets, total };
  }
  async exportRows(slug: string, query: ReportQuery, maxRows: number) {
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10000)
      throw invalid('maxRows', 'El límite de exportación no es válido.');
    // Nunca enviar Page: CSV/XLSX incluyen el resultado filtrado completo.
    return this.run(slug, query, [int('MaxRows', maxRows)]);
  }
  private async run(slug: string, query: ReportQuery, controls: Param[] = []) {
    if (!Object.prototype.hasOwnProperty.call(reports, slug)) throw notFound();
    const report = reports[slug as keyof typeof reports];
    if (query.search?.includes('\u0000'))
      throw invalid('search', 'La búsqueda no admite caracteres nulos.');
    if (
      completeReports.has(slug) &&
      query.search !== undefined
    )
      throw invalid(
        'search',
        'Este historial se consulta por sus filtros específicos, sin búsqueda de texto.',
      );
    const allowed = new Set<string>([
      ...report.keys,
      'page',
      'pageSize',
      'search',
    ]);
    for (const key of Object.keys(query))
      if (!allowed.has(key))
        throw invalid(key, 'Este filtro no corresponde al reporte.');
    for (const key of slug === 'historial-cliente'
      ? ['idCliente']
      : slug === 'historial-equipo'
        ? ['numeroSerie']
        : slug === 'actividad-tecnico'
          ? ['idTecnico', 'fechaDesde', 'fechaHasta']
          : slug === 'trazabilidad'
            ? ['idOrden']
            : []) {
      if (!(query as unknown as Record<string, unknown>)[key])
        throw invalid(key, 'Este filtro es obligatorio.');
    }
    if (query.estado) {
      const states: readonly string[] =
        slug === 'ordenes-activas'
          ? orderStates
          : slug === 'compras-proveedor'
            ? ['PENDIENTE', 'RECIBIDA', 'ANULADA']
            : ['EMITIDA', 'PAGADA', 'ANULADA'];
      if (!states.includes(query.estado))
        throw invalid('estado', 'Estado no permitido para este reporte.');
    }
    const range = dateRange(query);
    const params: Param[] = [];
    for (const key of report.keys) {
      const value = (query as unknown as Record<string, unknown>)[key];
      if (key === 'fechaDesde')
        params.push(param('Desde', sql.DateTime2(0), range.desde));
      else if (key === 'fechaHasta')
        params.push(param('HastaExclusiva', sql.DateTime2(0), range.hasta));
      else if (key.startsWith('id'))
        params.push(int(key.charAt(0).toUpperCase() + key.slice(1), value));
      else if (key === 'codigoTipoMovimiento')
        params.push(text('CodigoTipo', 30, value));
      else if (key === 'conSaldo')
        params.push(param('ConSaldo', sql.Bit, value ?? true));
      else
        params.push(
          text(
            key.charAt(0).toUpperCase() + key.slice(1),
            key === 'numeroSerie' ? 60 : 30,
            value,
          ),
        );
    }
    if (slug === 'ingresos') return this.ingresos(query, range, controls);
    if (!completeReports.has(slug) && query.search !== undefined)
      params.push(param('Search', sql.NVarChar(150), query.search));
    try {
      const result = await this.db.execute(`dbo.${report.procedure}`, [...params, ...controls]);
      return result.recordsets as Row[][];
    } catch (error) {
      const { sqlNumber } = databaseDiagnostics(error);
      if (sqlNumber === 8144 || sqlNumber === 8145)
        throw new ApiError(503, 'SERVICIO_NO_DISPONIBLE',
          'Los reportes necesitan actualizar sus procedimientos SQL. Contacta a administración.', undefined, error);
      throw error;
    }
  }
  /** Ingresos por mes de Guatemala: agrupa en TS porque FechaFactura se guarda en UTC. */
  private async ingresos(
    query: ReportQuery,
    range: { desde: Date | null; hasta: Date | null },
    controls: Param[],
  ): Promise<Row[][]> {
    const control = (name: string) => controls.find((p) => p.name === name)?.value as number | null | undefined;
    const page = control('Page');
    const pageSize = control('PageSize') ?? 20;
    const maxRows = control('MaxRows');
    const result = await this.db.query(
      `SELECT FechaFactura,SubtotalManoObra,SubtotalRepuestos,Subtotal,Impuesto,Total FROM dbo.vw_Facturas
 WHERE Estado<>'ANULADA' AND (@IdCliente IS NULL OR IdCliente=@IdCliente)
 AND (@Desde IS NULL OR FechaFactura>=@Desde) AND (@HastaExclusiva IS NULL OR FechaFactura<@HastaExclusiva);`,
      [
        int('IdCliente', query.idCliente),
        param('Desde', sql.DateTime2(0), range.desde),
        param('HastaExclusiva', sql.DateTime2(0), range.hasta),
      ],
    );
    let rows = aggregateIngresos(result.recordset);
    if (query.search !== undefined) {
      const needle = query.search.toLowerCase();
      rows = rows.filter((r) => [r.TotalManoObra, r.TotalRepuestos, r.Subtotal, r.Impuesto, r.Total]
        .some((cents) => centsText(cents).includes(needle)));
    }
    if (maxRows != null && rows.length > maxRows)
      throw new ApiError(413, 'EXPORTACION_DEMASIADO_GRANDE',
        'La exportación supera 10000 filas en total. Ajusta los filtros; no se ha truncado ningún conjunto.');
    const total = rows.length;
    const slice = page == null ? rows : rows.slice((page - 1) * pageSize, page * pageSize);
    const data: Row[] = slice.map((r) => ({
      Anio: r.Anio, Mes: r.Mes, CantidadFacturas: String(r.CantidadFacturas),
      TotalManoObra: Number(r.TotalManoObra) / 100, TotalRepuestos: Number(r.TotalRepuestos) / 100,
      Subtotal: Number(r.Subtotal) / 100, Impuesto: Number(r.Impuesto) / 100, Total: Number(r.Total) / 100,
    }));
    return page == null ? [data] : [data, [{ TotalRows: String(total) }]];
  }
  async orderMovements(id: number) {
    return (
      await this.db.query(
        `SELECT m.IdMovimiento,m.IdBodega,m.BodegaNombre,m.IdRepuesto,m.CodigoRepuesto,m.RepuestoNombre,m.CodigoTipoMovimiento,m.Naturaleza,m.Cantidad,m.FechaMovimiento,m.IdUsuario,m.UsuarioNombre,m.DocumentoOrigen,m.NumeroDocumento,m.ExistenciaResultante,m.Observacion FROM dbo.vw_MovimientosInventario m JOIN dbo.vw_Consumos c ON c.IdRepuestoReparacion=m.IdRepuestoReparacion WHERE c.IdOrden=@Id ORDER BY m.IdMovimiento;`,
        [int('Id', id)],
      )
    ).recordset;
  }
}
