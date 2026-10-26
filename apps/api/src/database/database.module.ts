import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ReadRepository } from './read.repository';
@Global()
@Module({
  providers: [DatabaseService, ReadRepository],
  exports: [DatabaseService, ReadRepository],
})
export class DatabaseModule {}
