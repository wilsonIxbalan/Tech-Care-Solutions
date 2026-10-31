import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { StatusService } from './status.service';
import { Permissions, Public } from '../auth/access';
@ApiTags('disponibilidad')
@Controller()
export class StatusController {
  constructor(private readonly service: StatusService) {}
  @Public() @Get('health') health() {
    return this.service.health();
  }
  @ApiCookieAuth('session') @Get('ready') ready() {
    return this.service.ready();
  }
  @ApiTags('dashboard')
  @ApiCookieAuth('session')
  @Permissions('REPORTES_VER')
  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }
}
