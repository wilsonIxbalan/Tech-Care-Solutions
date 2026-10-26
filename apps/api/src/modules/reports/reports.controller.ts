import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { ReportQuery } from '../../common/query.dto';
import { Permissions } from '../auth/access';
import { ReportsService } from './reports.service';
@ApiTags('reportes')
@ApiCookieAuth('session')
@Permissions('REPORTES_VER')
@Controller('reportes')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('ordenes-activas') active(@Query() query: ReportQuery) {
    return this.service.report('ordenes-activas', query);
  }
  @Get('historial-cliente') client(@Query() query: ReportQuery) {
    return this.service.report('historial-cliente', query);
  }
  @Get('historial-equipo') equipment(@Query() query: ReportQuery) {
    return this.service.report('historial-equipo', query);
  }
  @Get('actividad-tecnico') technician(@Query() query: ReportQuery) {
    return this.service.report('actividad-tecnico', query);
  }
  @Get('repuestos-utilizados') consumed(@Query() query: ReportQuery) {
    return this.service.report('repuestos-utilizados', query);
  }
  @Get('inventario') inventory(@Query() query: ReportQuery) {
    return this.service.report('inventario', query);
  }
  @Get('bajo-minimo') minimum(@Query() query: ReportQuery) {
    return this.service.report('bajo-minimo', query);
  }
  @Get('compras-proveedor') purchases(@Query() query: ReportQuery) {
    return this.service.report('compras-proveedor', query);
  }
  @Get('movimientos') movements(@Query() query: ReportQuery) {
    return this.service.report('movimientos', query);
  }
  @Get('facturas-saldo') invoices(@Query() query: ReportQuery) {
    return this.service.report('facturas-saldo', query);
  }
  @Get('ingresos') income(@Query() query: ReportQuery) {
    return this.service.report('ingresos', query);
  }
  @Get('trazabilidad') trace(@Query() query: ReportQuery) {
    return this.service.report('trazabilidad', query);
  }
}
