import { Module } from '@nestjs/common';
import {
  ClientsController,
  EquipmentController,
  PartsController,
  SuppliersController,
  WarehousesController,
  UsersController,
  CatalogsController,
} from './masters.controller';
import { MastersService } from './masters.service';
import { MastersRepository } from './masters.repository';
@Module({
  controllers: [
    ClientsController,
    EquipmentController,
    PartsController,
    SuppliersController,
    WarehousesController,
    UsersController,
    CatalogsController,
  ],
  providers: [MastersService, MastersRepository],
})
export class MastersModule {}
