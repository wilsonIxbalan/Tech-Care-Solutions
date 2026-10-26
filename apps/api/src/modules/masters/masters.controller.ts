import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IdPipe as ParseIntPipe } from '../../common/id.pipe';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { MasterQuery } from '../../common/query.dto';
import { CurrentUser, Permissions, Roles } from '../auth/access';
import { SessionUser } from '../auth/auth.dto';
import { MastersService } from './masters.service';
import {
  ClientInput,
  ClientPatch,
  EquipmentInput,
  EquipmentPatch,
  PartInput,
  PartPatch,
  SupplierInput,
  SupplierPatch,
  WarehouseInput,
  WarehousePatch,
  UserInput,
  UserPatch,
  CatalogInput,
  CatalogPatch,
} from './masters.dto';

@ApiTags('clientes')
@ApiCookieAuth('session')
@Controller('clientes')
export class ClientsController {
  constructor(private readonly service: MastersService) {}
  @Permissions(
    'CLIENTES_GESTIONAR',
    'ORDENES_CREAR',
    'DIAGNOSTICO_REGISTRAR',
    'REPARACION_GESTIONAR',
    'FACTURAR',
    'PAGOS_REGISTRAR',
    'ENTREGAR_ORDEN',
    'REPORTES_VER',
  )
  @Get()
  list(@Query() query: MasterQuery) {
    return this.service.list('clientes', query);
  }
  @Permissions(
    'CLIENTES_GESTIONAR',
    'ORDENES_CREAR',
    'DIAGNOSTICO_REGISTRAR',
    'REPARACION_GESTIONAR',
    'FACTURAR',
    'PAGOS_REGISTRAR',
    'ENTREGAR_ORDEN',
    'REPORTES_VER',
  )
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one('clientes', id);
  }
  @Permissions('CLIENTES_GESTIONAR') @Post() create(
    @Body() dto: ClientInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('clientes', dto, undefined, user.idUsuario);
  }
  @Permissions('CLIENTES_GESTIONAR') @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ClientPatch,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('clientes', dto, id, user.idUsuario);
  }
}

@ApiTags('equipos')
@ApiCookieAuth('session')
@Controller('equipos')
export class EquipmentController {
  constructor(private readonly service: MastersService) {}
  @Permissions(
    'EQUIPOS_GESTIONAR',
    'ORDENES_CREAR',
    'DIAGNOSTICO_REGISTRAR',
    'REPARACION_GESTIONAR',
    'FACTURAR',
    'ENTREGAR_ORDEN',
    'REPORTES_VER',
  )
  @Get()
  list(@Query() query: MasterQuery) {
    return this.service.list('equipos', query);
  }
  @Permissions(
    'EQUIPOS_GESTIONAR',
    'ORDENES_CREAR',
    'DIAGNOSTICO_REGISTRAR',
    'REPARACION_GESTIONAR',
    'FACTURAR',
    'ENTREGAR_ORDEN',
    'REPORTES_VER',
  )
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one('equipos', id);
  }
  @Permissions('EQUIPOS_GESTIONAR') @Post() create(
    @Body() dto: EquipmentInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('equipos', dto, undefined, user.idUsuario);
  }
  @Permissions('EQUIPOS_GESTIONAR') @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EquipmentPatch,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('equipos', dto, id, user.idUsuario);
  }
}

@ApiTags('repuestos')
@ApiCookieAuth('session')
@Controller('repuestos')
export class PartsController {
  constructor(private readonly service: MastersService) {}
  @Permissions(
    'INVENTARIO_GESTIONAR',
    'REPUESTOS_CONSUMIR',
    'COMPRAS_GESTIONAR',
    'REPORTES_VER',
  )
  @Get()
  list(@Query() query: MasterQuery) {
    return this.service.list('repuestos', query);
  }
  @Permissions(
    'INVENTARIO_GESTIONAR',
    'REPUESTOS_CONSUMIR',
    'COMPRAS_GESTIONAR',
    'REPORTES_VER',
  )
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one('repuestos', id);
  }
  @Roles('ADMINISTRADOR', 'BODEGA') @Post() create(
    @Body() dto: PartInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('repuestos', dto, undefined, user.idUsuario);
  }
  @Roles('ADMINISTRADOR', 'BODEGA') @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PartPatch,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('repuestos', dto, id, user.idUsuario);
  }
}

@ApiTags('proveedores')
@ApiCookieAuth('session')
@Controller('proveedores')
export class SuppliersController {
  constructor(private readonly service: MastersService) {}
  @Permissions('PROVEEDORES_GESTIONAR', 'COMPRAS_GESTIONAR', 'REPORTES_VER')
  @Get()
  list(@Query() query: MasterQuery) {
    return this.service.list('proveedores', query);
  }
  @Permissions('PROVEEDORES_GESTIONAR', 'COMPRAS_GESTIONAR', 'REPORTES_VER')
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one('proveedores', id);
  }
  @Permissions('PROVEEDORES_GESTIONAR') @Post() create(
    @Body() dto: SupplierInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('proveedores', dto, undefined, user.idUsuario);
  }
  @Permissions('PROVEEDORES_GESTIONAR') @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SupplierPatch,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('proveedores', dto, id, user.idUsuario);
  }
}

@ApiTags('bodegas')
@ApiCookieAuth('session')
@Controller('bodegas')
export class WarehousesController {
  constructor(private readonly service: MastersService) {}
  @Permissions(
    'INVENTARIO_GESTIONAR',
    'REPUESTOS_CONSUMIR',
    'COMPRAS_GESTIONAR',
    'REPORTES_VER',
  )
  @Get()
  list(@Query() query: MasterQuery) {
    return this.service.list('bodegas', query);
  }
  @Permissions(
    'INVENTARIO_GESTIONAR',
    'REPUESTOS_CONSUMIR',
    'COMPRAS_GESTIONAR',
    'REPORTES_VER',
  )
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one('bodegas', id);
  }
  @Roles('ADMINISTRADOR', 'BODEGA') @Post() create(
    @Body() dto: WarehouseInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('bodegas', dto, undefined, user.idUsuario);
  }
  @Roles('ADMINISTRADOR', 'BODEGA') @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: WarehousePatch,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('bodegas', dto, id, user.idUsuario);
  }
}

@ApiTags('usuarios')
@ApiCookieAuth('session')
@Controller('usuarios')
export class UsersController {
  constructor(private readonly service: MastersService) {}
  @Roles('ADMINISTRADOR') @Get() list(@Query() query: MasterQuery) {
    return this.service.list('usuarios', query);
  }
  @Roles('ADMINISTRADOR') @Get(':id') one(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.one('usuarios', id);
  }
  @Roles('ADMINISTRADOR') @Post() create(
    @Body() dto: UserInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('usuarios', dto, undefined, user.idUsuario);
  }
  @Roles('ADMINISTRADOR') @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UserPatch,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.save('usuarios', dto, id, user.idUsuario);
  }
}

@ApiTags('catalogos')
@ApiCookieAuth('session')
@Controller('catalogos')
export class CatalogsController {
  constructor(private readonly service: MastersService) {}
  @Get() all() {
    return this.service.catalogs();
  }
  @Roles('ADMINISTRADOR') @Get(':catalogo') list(
    @Param('catalogo') name: string,
  ) {
    return this.service.catalogList(name);
  }
  @Roles('ADMINISTRADOR') @Post(':catalogo') create(
    @Param('catalogo') name: string,
    @Body() dto: CatalogInput,
  ) {
    return this.service.catalogSave(name, dto);
  }
  @Roles('ADMINISTRADOR') @Patch(':catalogo/:id') update(
    @Param('catalogo') name: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CatalogPatch,
  ) {
    return this.service.catalogSave(name, dto, id);
  }
}
