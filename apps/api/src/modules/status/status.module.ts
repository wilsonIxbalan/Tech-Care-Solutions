import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { StatusRepository } from './status.repository';
import { StatusService } from './status.service';
@Module({
  controllers: [StatusController],
  providers: [StatusService, StatusRepository],
})
export class StatusModule {}
