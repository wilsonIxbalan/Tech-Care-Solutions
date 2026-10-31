import { Injectable } from '@nestjs/common';
import { PurchaseQuery } from '../../common/query.dto';
import { ReadRepository } from '../../database/read.repository';
import { PurchaseInput } from './purchasing.dto';
import { PurchasingRepository } from './purchasing.repository';
@Injectable()
export class PurchasingService {
  constructor(
    private readonly repository: PurchasingRepository,
    private readonly reads: ReadRepository,
  ) {}
  list(query: PurchaseQuery) {
    return this.reads.list('compras', query);
  }
  detail(id: number) {
    return this.reads.purchaseDetail(id);
  }
  create(dto: PurchaseInput, actor: number) {
    return this.repository.create(dto, actor);
  }
  receive(id: number, actor: number) {
    return this.repository.receive(id, actor);
  }
}
