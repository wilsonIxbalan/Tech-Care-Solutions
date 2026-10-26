import { Module } from '@nestjs/common';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';
import { PurchasingRepository } from './purchasing.repository';
@Module({
  controllers: [PurchasingController],
  providers: [PurchasingService, PurchasingRepository],
})
export class PurchasingModule {}
