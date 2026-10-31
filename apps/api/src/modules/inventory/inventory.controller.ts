import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IdPipe as ParseIntPipe } from '../../common/id.pipe';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { InventoryQuery, MovementQuery } from '../../common/query.dto';
import { CurrentUser, Permissions } from '../auth/access';
import { SessionUser } from '../auth/auth.dto';
import { AdjustmentInput, MinimumInput } from './inventory.dto';
import { InventoryService } from './inventory.service';
@ApiTags('inventario')
@ApiCookieAuth('session')
@Controller('inventario')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}
  @Permissions(
    'INVENTARIO_GESTIONAR',
    'REPUESTOS_CONSUMIR',
    'COMPRAS_GESTIONAR',
    'REPORTES_VER',
  )
  @Get()
  list(@Query() query: InventoryQuery) {
    return this.service.list(query);
  }
  @Permissions(
    'INVENTARIO_GESTIONAR',
    'REPUESTOS_CONSUMIR',
    'COMPRAS_GESTIONAR',
    'REPORTES_VER',
  )
  @Get('movimientos')
  movements(@Query() query: MovementQuery) {
    return this.service.movements(query);
  }
  @Permissions('INVENTARIO_GESTIONAR')
  @Post('ajustes')
  @HttpCode(200)
  adjust(@Body() dto: AdjustmentInput, @CurrentUser() user: SessionUser) {
    return this.service.adjust(dto, user.idUsuario);
  }
  @Permissions('INVENTARIO_GESTIONAR')
  @Patch(':idBodega/:idRepuesto/stock-minimo')
  minimum(
    @Param('idBodega', ParseIntPipe) bodega: number,
    @Param('idRepuesto', ParseIntPipe) repuesto: number,
    @Body() dto: MinimumInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.minimum(bodega, repuesto, dto, user.idUsuario);
  }
}
