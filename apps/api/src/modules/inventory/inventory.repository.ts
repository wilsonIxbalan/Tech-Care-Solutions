import { Injectable } from '@nestjs/common';
import { DatabaseService, int, text } from '../../database/database.service';
import { AdjustmentInput, MinimumInput } from './inventory.dto';
@Injectable()
export class InventoryRepository {
  constructor(private readonly db: DatabaseService) {}
  adjust(dto: AdjustmentInput, actor: number) {
    return this.db.transaction(async (tx) => {
      await this.db.execute(
        'dbo.sp_AjustarInventario',
        [
          int('IdBodega', dto.idBodega),
          int('IdRepuesto', dto.idRepuesto),
          text('CodigoTipoMovimiento', 30, dto.codigoTipoMovimiento),
          int('Cantidad', dto.cantidad),
          int('IdUsuario', actor),
          text('Observacion', 300, dto.observacion),
        ],
        [],
        tx,
      );
      // El SP retiene el bloqueo de la bodega hasta commit: ésta es su última fila.
      const row = (
        await this.db.query(
          "SELECT TOP (1) ExistenciaResultante FROM dbo.vw_MovimientosInventario WHERE IdBodega=@IdBodega AND IdRepuesto=@IdRepuesto AND IdUsuario=@IdUsuario AND DocumentoOrigen='AJUSTE' ORDER BY IdMovimiento DESC;",
          [
            int('IdBodega', dto.idBodega),
            int('IdRepuesto', dto.idRepuesto),
            int('IdUsuario', actor),
          ],
          tx,
        )
      ).recordset[0];
      return {
        idBodega: dto.idBodega,
        idRepuesto: dto.idRepuesto,
        existenciaResultante: row.ExistenciaResultante,
      };
    });
  }
  async minimum(
    bodega: number,
    repuesto: number,
    dto: MinimumInput,
    actor: number,
  ) {
    await this.db.execute('dbo.usp_CambiarStockMinimo', [
      int('IdBodega', bodega),
      int('IdRepuesto', repuesto),
      int('StockMinimo', dto.stockMinimo),
      int('IdUsuario', actor),
    ]);
    return {
      idBodega: bodega,
      idRepuesto: repuesto,
      stockMinimo: dto.stockMinimo,
    };
  }
}
