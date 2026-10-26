import { Injectable } from '@nestjs/common';
import { InvoiceQuery } from '../../common/query.dto';
import { ReadRepository } from '../../database/read.repository';
import { CancelPaymentInput, InvoiceInput, PaymentInput } from './billing.dto';
import { BillingRepository } from './billing.repository';
@Injectable()
export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly reads: ReadRepository,
  ) {}
  list(query: InvoiceQuery) {
    return this.reads.list('facturas', query);
  }
  detail(id: number) {
    return this.reads.invoiceDetail(id);
  }
  preview(id: number, percentage: string) {
    return this.repository.preview(id, percentage);
  }
  invoice(id: number, dto: InvoiceInput, actor: number) {
    return this.repository.invoice(id, dto, actor);
  }
  pay(id: number, dto: PaymentInput, actor: number) {
    return this.repository.pay(id, dto, actor);
  }
  cancel(id: number, dto: CancelPaymentInput, actor: number) {
    return this.repository.cancel(id, dto, actor);
  }
}
