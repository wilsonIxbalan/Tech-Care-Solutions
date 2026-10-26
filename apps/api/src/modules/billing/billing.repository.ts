import { Injectable } from '@nestjs/common';
import { invalid, notFound } from '../../common/api-error';
import {
  DatabaseService,
  int,
  money,
  text,
} from '../../database/database.service';
import { ReadRepository } from '../../database/read.repository';
import { publicRow } from '../../database/rows';
import { CancelPaymentInput, InvoiceInput, PaymentInput } from './billing.dto';
@Injectable()
export class BillingRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly reads: ReadRepository,
  ) {}
  async preview(id: number, percentage: string) {
    await this.reads.one('ordenes', id);
    const result = await this.db.query(
      `SELECT x.SubtotalManoObra,x.SubtotalRepuestos,@Porcentaje AS PorcentajeImpuesto,
      CONVERT(DECIMAL(12,2),ROUND((x.SubtotalManoObra+x.SubtotalRepuestos)*@Porcentaje/100.0,2)) AS Impuesto,
      dbo.fn_TotalOrden(@IdOrden,@Porcentaje) AS Total
      FROM (SELECT dbo.fn_TotalManoObraOrden(@IdOrden) AS SubtotalManoObra,dbo.fn_TotalRepuestosOrden(@IdOrden) AS SubtotalRepuestos) x;`,
      [int('IdOrden', id), money('Porcentaje', percentage, 5)],
    );
    return publicRow(result.recordset[0]);
  }
  invoice(id: number, dto: InvoiceInput, actor: number) {
    return this.db.transaction(async (tx) => {
      const order = await this.reads.one('ordenes', id, tx);
      const client = (
        await this.db.query(
          'SELECT NIT,NombreMostrar,Direccion FROM dbo.Cliente WHERE IdCliente=@Id;',
          [int('Id', order.idCliente)],
          tx,
        )
      ).recordset[0];
      const nit = dto.nitFacturacion ?? String(client.NIT);
      const nombre = dto.nombreFacturacion ?? String(client.NombreMostrar);
      const direccion = dto.direccionFacturacion ?? client.Direccion;
      if (!nit.trim() || nit.length > 20)
        throw invalid(
          'nitFacturacion',
          'El NIT fiscal debe tener entre 1 y 20 caracteres.',
        );
      if (!nombre.trim() || nombre.length > 150)
        throw invalid(
          'nombreFacturacion',
          'El nombre fiscal debe tener entre 1 y 150 caracteres; indícalo explícitamente si el nombre del cliente supera ese máximo.',
        );
      if (typeof direccion === 'string' && direccion.length > 250)
        throw invalid(
          'direccionFacturacion',
          'La dirección fiscal supera 250 caracteres.',
        );
      const result = await this.db.execute(
        'dbo.sp_GenerarFactura',
        [
          int('IdOrden', id),
          int('IdUsuario', actor),
          text('NITFacturacion', 20, nit),
          text('NombreFacturacion', 150, nombre),
          text('DireccionFacturacion', 250, direccion),
          money('PorcentajeImpuesto', dto.porcentajeImpuesto, 5),
        ],
        ['IdFactura'],
        tx,
      );
      const invoice = await this.reads.one(
        'facturas',
        Number(result.output.IdFactura),
        tx,
      );
      return {
        idFactura: invoice.idFactura,
        numeroFactura: invoice.numeroFactura,
        estado: invoice.estado,
        subtotalManoObra: invoice.subtotalManoObra,
        subtotalRepuestos: invoice.subtotalRepuestos,
        subtotal: invoice.subtotal,
        impuesto: invoice.impuesto,
        total: invoice.total,
        saldo: invoice.saldo,
      };
    });
  }
  pay(id: number, dto: PaymentInput, actor: number) {
    return this.db.transaction(async (tx) => {
      const result = await this.db.execute(
        'dbo.sp_RegistrarPago',
        [
          int('IdFactura', id),
          int('IdMetodoPago', dto.idMetodoPago),
          money('Monto', dto.monto),
          int('IdUsuario', actor),
          text('Referencia', 60, dto.referencia),
        ],
        ['IdPago'],
        tx,
      );
      const invoice = await this.reads.one('facturas', id, tx);
      return {
        idPago: result.output.IdPago as number,
        idFactura: id,
        saldo: invoice.saldo,
        estadoFactura: invoice.estado,
      };
    });
  }
  cancel(id: number, dto: CancelPaymentInput, actor: number) {
    return this.db.transaction(async (tx) => {
      await this.db.execute(
        'dbo.sp_AnularPago',
        [
          int('IdPago', id),
          int('IdUsuario', actor),
          text('Motivo', 300, dto.motivo),
        ],
        [],
        tx,
      );
      const payment = (await this.reads.children('pagos', 'IdPago', id, tx))[0];
      if (!payment) throw notFound();
      const invoice = await this.reads.one(
        'facturas',
        Number(payment.idFactura),
        tx,
      );
      return {
        idPago: id,
        estado: payment.estado,
        saldo: invoice.saldo,
        estadoFactura: invoice.estado,
      };
    });
  }
}
