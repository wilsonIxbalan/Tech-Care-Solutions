import { Max } from 'class-validator';
import { BooleanField, Choice, CivilDate, Id, Text } from './validation';
import { invalid } from './api-error';
export const orderStates = [
  'RECIBIDO',
  'DIAGNOSTICO',
  'ESPERANDO_AUTORIZACION',
  'REPARACION',
  'LISTO',
  'ENTREGADO',
  'CANCELADO',
] as const;
export class PageQuery {
  @Id(true, 1, true) page = 1;
  @Id(true, 1, true) @Max(100) pageSize = 20;
  @Text(150, true) search?: string;
}
export class DateQuery extends PageQuery {
  @CivilDate() fechaDesde?: string;
  @CivilDate() fechaHasta?: string;
}
export class MasterQuery extends PageQuery {
  @Text(12, true) estado?: string;
  @Id(true, 1, true) idCliente?: number;
  @Id(true, 1, true) idCategoria?: number;
  @BooleanField(true, true) activo?: boolean;
}
export class OrderQuery extends DateQuery {
  @Id(true, 1, true) idCliente?: number;
  @Id(true, 1, true) idEquipo?: number;
  @Id(true, 1, true) idPrioridad?: number;
  @Id(true, 1, true) idTecnico?: number;
  @Choice(orderStates, true) estado?: string;
}
export class PurchaseQuery extends DateQuery {
  @Id(true, 1, true) idProveedor?: number;
  @Id(true, 1, true) idBodegaDestino?: number;
  @Choice(['PENDIENTE', 'RECIBIDA', 'ANULADA'], true) estado?: string;
}
export class InventoryQuery extends PageQuery {
  @Id(true, 1, true) idBodega?: number;
  @Id(true, 1, true) idCategoria?: number;
  @Id(true, 1, true) idRepuesto?: number;
  @BooleanField(true, true) bajoMinimo?: boolean;
}
export class MovementQuery extends DateQuery {
  @Id(true, 1, true) idBodega?: number;
  @Id(true, 1, true) idRepuesto?: number;
  @Id(true, 1, true) idUsuario?: number;
  @Text(30, true) codigoTipoMovimiento?: string;
}
export class InvoiceQuery extends DateQuery {
  @Id(true, 1, true) idCliente?: number;
  @Choice(['EMITIDA', 'PAGADA', 'ANULADA'], true) estado?: string;
  @BooleanField(true, true) conSaldo?: boolean;
}
export class ReportQuery extends DateQuery {
  @Id(true, 1, true) idCliente?: number;
  @Id(true, 1, true) idOrden?: number;
  @Id(true, 1, true) idTecnico?: number;
  @Id(true, 1, true) idPrioridad?: number;
  @Id(true, 1, true) idBodega?: number;
  @Id(true, 1, true) idRepuesto?: number;
  @Id(true, 1, true) idCategoria?: number;
  @Id(true, 1, true) idProveedor?: number;
  @Id(true, 1, true) idUsuario?: number;
  @Text(60, true) numeroSerie?: string;
  @Text(30, true) estado?: string;
  @Text(30, true) codigoTipoMovimiento?: string;
  @BooleanField(true, true) conSaldo?: boolean;
}
export function dateRange(query: { fechaDesde?: string; fechaHasta?: string }) {
  if (
    query.fechaDesde &&
    query.fechaHasta &&
    query.fechaDesde > query.fechaHasta
  )
    throw invalid('fechaHasta', 'Debe ser igual o posterior a fechaDesde.');
  const desde = query.fechaDesde
    ? new Date(`${query.fechaDesde}T06:00:00.000Z`)
    : null;
  const hasta = query.fechaHasta
    ? new Date(
        new Date(`${query.fechaHasta}T06:00:00.000Z`).getTime() + 86400000,
      )
    : null;
  if (hasta && hasta.getUTCFullYear() > 9999)
    throw invalid(
      'fechaHasta',
      'El límite exclusivo supera el rango de fecha de SQL Server.',
    );
  return { desde, hasta };
}
