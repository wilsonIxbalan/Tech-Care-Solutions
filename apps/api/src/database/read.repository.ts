import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { notFound } from '../common/api-error';
import { dateRange, PageQuery } from '../common/query.dto';
import {
  DatabaseService,
  int,
  param,
  Param,
  Row,
  text,
} from './database.service';
import { pagination, publicRow, publicRows } from './rows';

const reads = {
  ordenes: {
    view: 'vw_Ordenes',
    id: 'IdOrden',
    columns:
      'IdOrden,NumeroOrden,IdCliente,ClienteNombre,IdEquipo,NumeroSerie,IdUsuarioRecepcion,FechaIngreso,ProblemaReportado,IdPrioridad,Prioridad,Estado,FechaEstimada,Observaciones',
    search: ['NumeroOrden', 'ClienteNombre', 'NumeroSerie'],
    date: 'FechaIngreso',
    filters: ['IdCliente', 'IdEquipo', 'Estado', 'IdPrioridad'],
  },
  compras: {
    view: 'vw_Compras',
    id: 'IdCompra',
    columns:
      'IdCompra,NumeroCompra,IdProveedor,ProveedorNombre,IdBodegaDestino,BodegaNombre,IdUsuarioRegistro,FechaCompra,FechaRecepcion,IdUsuarioRecepcion,NumeroDocumentoProveedor,Estado,Observaciones,Total',
    search: ['NumeroCompra', 'ProveedorNombre', 'NumeroDocumentoProveedor'],
    date: 'FechaCompra',
    filters: ['IdProveedor', 'IdBodegaDestino', 'Estado'],
  },
  facturas: {
    view: 'vw_Facturas',
    id: 'IdFactura',
    columns:
      'IdFactura,NumeroFactura,IdOrden,NumeroOrden,IdCliente,ClienteNombre,NITFacturacion,NombreFacturacion,DireccionFacturacion,FechaFactura,SubtotalManoObra,SubtotalRepuestos,PorcentajeImpuesto,Subtotal,Impuesto,Total,TotalPagado,Saldo,Estado',
    search: ['NumeroFactura', 'NumeroOrden', 'ClienteNombre', 'NITFacturacion'],
    date: 'FechaFactura',
    filters: ['IdCliente', 'Estado'],
  },
  inventario: {
    view: 'vw_InventarioActual',
    id: 'IdBodega,IdRepuesto',
    columns:
      'IdBodega,BodegaNombre,IdCategoria,CategoriaNombre,IdRepuesto,CodigoRepuesto,RepuestoNombre,Existencia,StockMinimo,BajoMinimo,SinStock,FechaUltimoMovimiento',
    search: ['CodigoRepuesto', 'RepuestoNombre', 'BodegaNombre'],
    date: '',
    filters: ['IdBodega', 'IdCategoria', 'IdRepuesto', 'BajoMinimo'],
  },
  movimientos: {
    view: 'vw_MovimientosInventario',
    id: 'IdMovimiento',
    columns:
      'IdMovimiento,IdBodega,BodegaNombre,IdRepuesto,CodigoRepuesto,RepuestoNombre,CodigoTipoMovimiento,Naturaleza,Cantidad,FechaMovimiento,IdUsuario,UsuarioNombre,DocumentoOrigen,NumeroDocumento,ExistenciaResultante,Observacion',
    search: ['CodigoRepuesto', 'RepuestoNombre', 'NumeroDocumento'],
    date: 'FechaMovimiento',
    filters: ['IdBodega', 'IdRepuesto', 'CodigoTipoMovimiento', 'IdUsuario'],
  },
} as const;
export type ReadName = keyof typeof reads;
const childReads = {
  diagnosticos: [
    'vw_Diagnosticos',
    'IdDiagnostico,IdOrden,IdTecnico,TecnicoNombre,FechaDiagnostico,Descripcion,CostoManoObraEstimado,Estado',
    'IdDiagnostico',
  ],
  reparaciones: [
    'vw_Reparaciones',
    'IdReparacion,IdOrden,IdDiagnostico,IdTecnico,TecnicoNombre,FechaInicio,FechaFin,Descripcion,CostoManoObra,Estado',
    'IdReparacion',
  ],
  actividades: [
    'vw_Actividades',
    'IdActividad,IdReparacion,IdTecnico,TecnicoNombre,Descripcion,FechaActividad,HorasInvertidas',
    'IdActividad',
  ],
  consumos: [
    'vw_Consumos',
    'IdRepuestoReparacion,IdReparacion,IdOrden,IdBodega,BodegaNombre,IdRepuesto,CodigoRepuesto,RepuestoNombre,Cantidad,PrecioCostoUnitario,PrecioVentaUnitario,Subtotal,FechaAsignacion,IdUsuario,Estado',
    'IdRepuestoReparacion',
  ],
  historial: [
    'vw_HistorialEstadoOrden',
    'IdHistorial,IdOrden,EstadoAnterior,EstadoNuevo,FechaCambio,IdUsuario,UsuarioNombre,Observacion',
    'IdHistorial',
  ],
  pagos: [
    'vw_Pagos',
    'IdPago,IdFactura,IdMetodoPago,MetodoPagoNombre,Monto,FechaPago,Referencia,IdUsuario,UsuarioNombre,Estado,MotivoAnulacion',
    'IdPago',
  ],
  detalles: [
    'vw_DetalleFactura',
    'IdDetalleFactura,IdFactura,TipoLinea,IdReparacion,IdRepuestoReparacion,Descripcion,Cantidad,PrecioUnitario,Subtotal',
    'IdDetalleFactura',
  ],
  items: [
    'vw_DetalleCompra',
    'IdDetalleCompra,IdCompra,IdRepuesto,CodigoRepuesto,RepuestoNombre,Cantidad,CostoUnitario,Subtotal',
    'IdDetalleCompra',
  ],
  entregas: [
    'vw_Entregas',
    'IdEntrega,IdOrden,IdUsuarioEntrega,UsuarioEntregaNombre,NombreRecibe,DocumentoRecibe,FechaEntrega,Observaciones',
    'IdEntrega',
  ],
} as const;
@Injectable()
export class ReadRepository {
  constructor(private readonly db: DatabaseService) {}
  async list(name: ReadName, query: PageQuery & object) {
    const config = reads[name];
    const q = query as unknown as Record<string, unknown>;
    const params: Param[] = [];
    const conditions: string[] = [];
    for (const field of config.filters) {
      const key = field.charAt(0).toLowerCase() + field.slice(1);
      if (q[key] !== undefined) {
        conditions.push(`v.${field}=@${field}`);
        params.push(
          field.startsWith('Id')
            ? int(field, q[key])
            : field === 'BajoMinimo'
              ? param(field, sql.Bit, q[key])
              : text(field, 30, q[key]),
        );
      }
    }
    if (query.search) {
      conditions.push(
        `(${config.search.map((field) => `v.${field} LIKE @Search ESCAPE '~'`).join(' OR ')})`,
      );
      params.push(
        text('Search', 310, `%${query.search.replace(/[~%_\[]/g, '~$&')}%`),
      );
    }
    const range = dateRange(q as { fechaDesde?: string; fechaHasta?: string });
    if (config.date) {
      if (range.desde) {
        conditions.push(`v.${config.date}>=@Desde`);
        params.push(param('Desde', sql.DateTime2(0), range.desde));
      }
      if (range.hasta) {
        conditions.push(`v.${config.date}<@Hasta`);
        params.push(param('Hasta', sql.DateTime2(0), range.hasta));
      }
    }
    if (name === 'facturas' && q.conSaldo === true)
      conditions.push('v.Saldo>0');
    if (name === 'ordenes' && q.idTecnico !== undefined) {
      conditions.push(
        '(EXISTS(SELECT 1 FROM dbo.vw_Diagnosticos d WHERE d.IdOrden=v.IdOrden AND d.IdTecnico=@IdTecnico) OR EXISTS(SELECT 1 FROM dbo.vw_Reparaciones r WHERE r.IdOrden=v.IdOrden AND r.IdTecnico=@IdTecnico))',
      );
      params.push(int('IdTecnico', q.idTecnico));
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT COUNT(*) AS Total FROM dbo.${config.view} v ${where}; SELECT ${config.columns
        .split(',')
        .map((column) => `v.${column}`)
        .join(',')} FROM dbo.${config.view} v ${where} ORDER BY ${config.id
        .split(',')
        .map((column) => `v.${column} DESC`)
        .join(',')} OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;`,
      [
        ...params,
        param('Offset', sql.BigInt, (query.page - 1) * query.pageSize),
        int('Limit', query.pageSize),
      ],
    );
    const sets = result.recordsets as Row[][];
    return {
      data: publicRows(sets[1]),
      meta: pagination(query.page, query.pageSize, Number(sets[0][0].Total)),
    };
  }
  async one(
    name: 'ordenes' | 'compras' | 'facturas',
    id: number,
    tx?: sql.Transaction,
  ) {
    const config = reads[name];
    const row = (
      await this.db.query(
        `SELECT ${config.columns} FROM dbo.${config.view} WHERE ${config.id}=@Id;`,
        [int('Id', id)],
        tx,
      )
    ).recordset[0];
    if (!row) throw notFound();
    return publicRow(row);
  }
  async children(
    name: keyof typeof childReads,
    column: 'IdOrden' | 'IdReparacion' | 'IdFactura' | 'IdCompra' | 'IdPago',
    id: number,
    tx?: sql.Transaction,
  ) {
    const [view, columns, order] = childReads[name];
    return publicRows(
      (
        await this.db.query(
          `SELECT ${columns} FROM dbo.${view} WHERE ${column}=@Id ORDER BY ${order};`,
          [int('Id', id)],
          tx,
        )
      ).recordset,
    );
  }
  async invoiceDetail(id: number, tx?: sql.Transaction) {
    const invoice = await this.one('facturas', id, tx);
    return {
      ...invoice,
      detalles: await this.children('detalles', 'IdFactura', id, tx),
      pagos: await this.children('pagos', 'IdFactura', id, tx),
    };
  }
  async purchaseDetail(id: number, tx?: sql.Transaction) {
    return {
      ...(await this.one('compras', id, tx)),
      items: await this.children('items', 'IdCompra', id, tx),
    };
  }
  async orderDetail(id: number, tx?: sql.Transaction) {
    const order = await this.one('ordenes', id, tx);
    const repairs = await this.children('reparaciones', 'IdOrden', id, tx);
    for (const repair of repairs) {
      repair.actividades = await this.children(
        'actividades',
        'IdReparacion',
        Number(repair.idReparacion),
        tx,
      );
      repair.repuestos = await this.children(
        'consumos',
        'IdReparacion',
        Number(repair.idReparacion),
        tx,
      );
    }
    const invoice = (
      await this.db.query(
        'SELECT IdFactura FROM dbo.vw_Facturas WHERE IdOrden=@Id;',
        [int('Id', id)],
        tx,
      )
    ).recordset[0];
    return {
      ...order,
      historial: await this.children('historial', 'IdOrden', id, tx),
      diagnosticos: await this.children('diagnosticos', 'IdOrden', id, tx),
      reparaciones: repairs,
      factura: invoice
        ? await this.invoiceDetail(Number(invoice.IdFactura), tx)
        : null,
      entrega: (await this.children('entregas', 'IdOrden', id, tx))[0] ?? null,
    };
  }
  async repair(id: number, tx?: sql.Transaction) {
    const rows = (
      await this.db.query(
        `SELECT ${childReads.reparaciones[1]} FROM dbo.vw_Reparaciones WHERE IdReparacion=@Id;`,
        [int('Id', id)],
        tx,
      )
    ).recordset;
    if (!rows.length) throw notFound();
    return publicRow(rows[0]);
  }
  async dashboard() {
    const result = await this.db.query(
      'SELECT OrdenesAbiertas,OrdenesEnDiagnostico,OrdenesEnReparacion,OrdenesListas,FacturasConSaldo,RepuestosBajoMinimo FROM dbo.vw_DashboardResumen; SELECT TOP (10) Tipo,Descripcion,Fecha FROM dbo.vw_ActividadReciente ORDER BY Fecha DESC,Tipo,Descripcion;',
    );
    const sets = result.recordsets as Row[][];
    return { ...publicRow(sets[0][0]), actividadReciente: publicRows(sets[1]) };
  }
}
