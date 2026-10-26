import { Injectable } from '@nestjs/common';
import { InventoryQuery, MovementQuery } from '../../common/query.dto';
import { ReadRepository } from '../../database/read.repository';
import { AdjustmentInput, MinimumInput } from './inventory.dto';
import { InventoryRepository } from './inventory.repository';
@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly reads: ReadRepository,
  ) {}
  list(query: InventoryQuery) {
    return this.reads.list('inventario', query);
  }
  movements(query: MovementQuery) {
    return this.reads.list('movimientos', query);
  }
  adjust(dto: AdjustmentInput, actor: number) {
    return this.repository.adjust(dto, actor);
  }
  minimum(bodega: number, repuesto: number, dto: MinimumInput, actor: number) {
    return this.repository.minimum(bodega, repuesto, dto, actor);
  }
}
