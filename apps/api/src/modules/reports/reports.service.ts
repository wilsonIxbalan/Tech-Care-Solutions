import { Injectable } from '@nestjs/common';
import { notFound } from '../../common/api-error';
import { ReportQuery } from '../../common/query.dto';
import { ReadRepository } from '../../database/read.repository';
import { pagination, publicRow, publicRows } from '../../database/rows';
import { completeReports, ReportsRepository } from './reports.repository';
@Injectable()
export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly reads: ReadRepository,
  ) {}
  async report(slug: string, query: ReportQuery) {
    if (!completeReports.has(slug)) {
      const { sets, total } = await this.repository.paged(slug, query);
      const rows = publicRows(sets[0]);
      if (slug === 'facturas-saldo') {
        const payments = new Map<unknown, ReturnType<typeof publicRows>>();
        for (const payment of publicRows(sets[1])) {
          const group = payments.get(payment.idFactura);
          if (group) group.push(payment);
          else payments.set(payment.idFactura, [payment]);
        }
        for (const row of rows) row.pagos = payments.get(row.idFactura) ?? [];
      }
      return { data: rows, meta: pagination(query.page ?? 1, query.pageSize ?? 20, total) };
    }
    const sets = await this.repository.execute(slug, query);
    if (slug === 'historial-cliente' || slug === 'historial-equipo') {
      if (!sets[0].length) throw notFound();
      const ids = [
        ...new Set(
          sets[1]
            .filter((r) => r.IdOrden !== null)
            .map((r) => Number(r.IdOrden)),
        ),
      ];
      // Paginación no corta relaciones hijas: un historial es un único recurso.
      const ordenes = await this.reads.orderDetails(ids);
      return {
        [slug === 'historial-cliente' ? 'cliente' : 'equipo']: publicRow(
          sets[0][0],
        ),
        ordenes,
      };
    }
    if (slug === 'trazabilidad') {
      const detail = await this.reads.orderDetail(query.idOrden!);
      const {
        historial,
        diagnosticos,
        reparaciones,
        factura,
        entrega,
        ...orden
      } = detail;
      return {
        orden,
        historial,
        diagnosticos,
        reparaciones,
        movimientos: publicRows(
          await this.repository.orderMovements(query.idOrden!),
        ),
        factura,
        pagos: factura?.pagos ?? [],
        entrega,
      };
    }
    throw notFound();
  }
}
