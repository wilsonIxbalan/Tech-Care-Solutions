import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import {
  DatabaseService,
  int,
  param,
  text,
} from '../../database/database.service';
import { ReadRepository } from '../../database/read.repository';
import { PurchaseInput } from './purchasing.dto';
@Injectable()
export class PurchasingRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly reads: ReadRepository,
  ) {}
  create(dto: PurchaseInput, actor: number) {
    const detail = new sql.Table('dbo.tvp_DetalleCompra');
    detail.columns.add('IdRepuesto', sql.Int, { nullable: false });
    detail.columns.add('Cantidad', sql.Int, { nullable: false });
    detail.columns.add('CostoUnitario', sql.Decimal(12, 2), {
      nullable: false,
    });
    for (const item of dto.items)
      detail.rows.add(
        item.idRepuesto,
        item.cantidad,
        Number(item.costoUnitario),
      );
    return this.db.transaction(async (tx) => {
      const result = await this.db.execute(
        'dbo.sp_RegistrarCompra',
        [
          int('IdProveedor', dto.idProveedor),
          int('IdBodegaDestino', dto.idBodegaDestino),
          int('IdUsuario', actor),
          text('NumeroDocumentoProveedor', 40, dto.numeroDocumentoProveedor),
          text('Observaciones', 500, dto.observaciones),
          param('Detalle', sql.TVP, detail),
        ],
        ['IdCompra'],
        tx,
      );
      const purchase = await this.reads.one(
        'compras',
        Number(result.output.IdCompra),
        tx,
      );
      return {
        idCompra: purchase.idCompra,
        numeroCompra: purchase.numeroCompra,
        estado: purchase.estado,
      };
    });
  }
  receive(id: number, actor: number) {
    return this.db.transaction(async (tx) => {
      await this.db.execute(
        'dbo.sp_RecibirCompra',
        [int('IdCompra', id), int('IdUsuario', actor)],
        [],
        tx,
      );
      return {
        idCompra: id,
        estado: (await this.reads.one('compras', id, tx)).estado,
      };
    });
  }
}
