import { Module } from '@nestjs/common';
import {
  OrderBillingController,
  InvoicesController,
  PaymentsController,
} from './billing.controller';
import { BillingService } from './billing.service';
import { BillingRepository } from './billing.repository';
@Module({
  controllers: [OrderBillingController, InvoicesController, PaymentsController],
  providers: [BillingService, BillingRepository],
})
export class BillingModule {}
