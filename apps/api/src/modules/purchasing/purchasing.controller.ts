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
import { PurchaseQuery } from '../../common/query.dto';
import { CurrentUser, Permissions } from '../auth/access';
import { SessionUser } from '../auth/auth.dto';
import { EmptyInput } from '../service/service.dto';
import { PurchaseInput } from './purchasing.dto';
import { PurchasingService } from './purchasing.service';
@ApiTags('compras')
@ApiCookieAuth('session')
@Permissions('COMPRAS_GESTIONAR')
@Controller('compras')
export class PurchasingController {
  constructor(private readonly service: PurchasingService) {}
  @Get() list(@Query() query: PurchaseQuery) {
    return this.service.list(query);
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }
  @Post() create(@Body() dto: PurchaseInput, @CurrentUser() user: SessionUser) {
    return this.service.create(dto, user.idUsuario);
  }
  @Post(':id/recibir')
  @HttpCode(200)
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() _dto: EmptyInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.receive(id, user.idUsuario);
  }
}
