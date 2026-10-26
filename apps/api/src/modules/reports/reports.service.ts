import { Injectable } from '@nestjs/common';
import { notFound } from '../../common/api-error';
import { ReportQuery } from '../../common/query.dto';
import { ReadRepository } from '../../database/read.repository';
import { pagination, publicRow, publicRows } from '../../database/rows';
import { ReportsRepository } from './reports.repository';
@Injectable()
export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly reads: ReadRepository,
  ) {}
  async report(slug: string, query: ReportQuery) {
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
      const ordenes = [];
      for (const id of ids) ordenes.push(await this.reads.orderDetail(id));
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
    let rows = publicRows(sets[0]);
    if (query.search) {
      const search = query.search.toLocaleLowerCase('es');
      rows = rows.filter((row) =>
        Object.values(row).some(
          (value) =>
            typeof value === 'string' &&
            value.toLocaleLowerCase('es').includes(search),
        ),
      );
    }
    const total = rows.length;
    rows = rows.slice(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize,
    );
    if (slug === 'facturas-saldo') {
      // Cabecera y pagos son resultsets distintos; no multiplicar importes.
      const payments = publicRows(sets[1]);
      for (const row of rows)
        row.pagos = payments.filter(
          (payment) => payment.idFactura === row.idFactura,
        );
    }
    return { data: rows, meta: pagination(query.page, query.pageSize, total) };
  }
}
