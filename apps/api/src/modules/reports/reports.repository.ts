import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { invalid, notFound } from '../../common/api-error';
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
@Injectable()
export class ReportsRepository {
  constructor(private readonly db: DatabaseService) {}
  async execute(slug: string, query: ReportQuery) {
    if (!Object.prototype.hasOwnProperty.call(reports, slug)) throw notFound();
    const report = reports[slug as keyof typeof reports];
    if (
      ['historial-cliente', 'historial-equipo', 'trazabilidad'].includes(slug) &&
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
    const result = await this.db.execute(`dbo.${report.procedure}`, params);
    return result.recordsets as Row[][];
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
