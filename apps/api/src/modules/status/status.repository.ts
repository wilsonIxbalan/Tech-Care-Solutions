import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ReadRepository } from '../../database/read.repository';
@Injectable()
export class StatusRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly reads: ReadRepository,
  ) {}
  async ready() {
    await this.db.query('SELECT 1 AS Ready;');
  }
  dashboard() {
    return this.reads.dashboard();
  }
}
