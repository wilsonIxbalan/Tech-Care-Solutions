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
import { InvoiceQuery } from '../../common/query.dto';
import { CurrentUser, Permissions } from '../auth/access';
import { SessionUser } from '../auth/auth.dto';
import {
  BillingPreviewQuery,
  CancelPaymentInput,
  InvoiceInput,
  PaymentInput,
} from './billing.dto';
import { BillingService } from './billing.service';
@ApiTags('facturacion')
@ApiCookieAuth('session')
@Controller('ordenes')
export class OrderBillingController {
  constructor(private readonly service: BillingService) {}
  @Permissions('FACTURAR')
  @Get(':id/resumen-facturacion')
  preview(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: BillingPreviewQuery,
  ) {
    return this.service.preview(id, query.porcentajeImpuesto);
  }
  @Permissions('FACTURAR')
  @Post(':id/factura')
  invoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InvoiceInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.invoice(id, dto, user.idUsuario);
  }
}
@ApiTags('facturas')
@ApiCookieAuth('session')
@Controller('facturas')
export class InvoicesController {
  constructor(private readonly service: BillingService) {}
  @Permissions('FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER')
  @Get()
  list(@Query() query: InvoiceQuery) {
    return this.service.list(query);
  }
  @Permissions('FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER')
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }
  @Permissions('PAGOS_REGISTRAR')
  @Post(':id/pagos')
  pay(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PaymentInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.pay(id, dto, user.idUsuario);
  }
}
@ApiTags('pagos')
@ApiCookieAuth('session')
@Controller('pagos')
export class PaymentsController {
  constructor(private readonly service: BillingService) {}
  @Permissions('PAGOS_REGISTRAR')
  @Post(':id/anular')
  @HttpCode(200)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPaymentInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.cancel(id, dto, user.idUsuario);
  }
}
