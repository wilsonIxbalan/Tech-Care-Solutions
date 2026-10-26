import { Module } from '@nestjs/common';
import { OrdersController, RepairsController } from './service.controller';
import { ServiceService } from './service.service';
import { ServiceRepository } from './service.repository';
@Module({
  controllers: [OrdersController, RepairsController],
  providers: [ServiceService, ServiceRepository],
})
export class ServiceModule {}
