import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IdPipe as ParseIntPipe } from '../../common/id.pipe';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { OrderQuery } from '../../common/query.dto';
import { CurrentUser, Permissions, Roles } from '../auth/access';
import { SessionUser } from '../auth/auth.dto';
import {
  ActivityInput,
  ConsumptionInput,
  DeliveryInput,
  DiagnosisInput,
  FinishInput,
  OrderInput,
  RepairInput,
  StateInput,
} from './service.dto';
import { ServiceService } from './service.service';
@ApiTags('ordenes')
@ApiCookieAuth('session')
@Controller('ordenes')
export class OrdersController {
  constructor(private readonly service: ServiceService) {}
  @Permissions(
    'ORDENES_CREAR',
    'DIAGNOSTICO_REGISTRAR',
    'REPARACION_GESTIONAR',
    'REPUESTOS_CONSUMIR',
    'FACTURAR',
    'PAGOS_REGISTRAR',
    'ENTREGAR_ORDEN',
    'REPORTES_VER',
  )
  @Get()
  list(@Query() query: OrderQuery) {
    return this.service.list(query);
  }
  @Permissions(
    'ORDENES_CREAR',
    'DIAGNOSTICO_REGISTRAR',
    'REPARACION_GESTIONAR',
    'REPUESTOS_CONSUMIR',
    'FACTURAR',
    'PAGOS_REGISTRAR',
    'ENTREGAR_ORDEN',
    'REPORTES_VER',
  )
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }
  @Permissions('ORDENES_CREAR')
  @Post()
  create(@Body() dto: OrderInput, @CurrentUser() user: SessionUser) {
    return this.service.create(dto, user);
  }
  @Permissions('DIAGNOSTICO_REGISTRAR')
  @Roles('TECNICO')
  @Post(':id/diagnostico')
  diagnosis(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DiagnosisInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.diagnosis(id, dto, user);
  }
  @Permissions('REPARACION_GESTIONAR')
  @Roles('TECNICO')
  @Post(':id/reparaciones')
  repair(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RepairInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.repair(id, dto, user);
  }
  @Post(':id/estado')
  @HttpCode(200)
  state(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StateInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.state(id, dto, user);
  }
  @Permissions('ENTREGAR_ORDEN')
  @Post(':id/entrega')
  @HttpCode(200)
  delivery(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeliveryInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.delivery(id, dto, user);
  }
}
@ApiTags('reparaciones')
@ApiCookieAuth('session')
@Controller('reparaciones')
export class RepairsController {
  constructor(private readonly service: ServiceService) {}
  @Permissions('REPARACION_GESTIONAR')
  @Post(':id/finalizar')
  @HttpCode(200)
  finish(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinishInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.finish(id, dto, user);
  }
  @Permissions('REPARACION_GESTIONAR')
  @Roles('TECNICO')
  @Post(':id/actividades')
  activity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActivityInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.activity(id, dto, user);
  }
  @Permissions('REPUESTOS_CONSUMIR')
  @Post(':id/repuestos')
  consume(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConsumptionInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.consume(id, dto, user);
  }
}
