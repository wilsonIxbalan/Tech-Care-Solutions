import { Injectable } from '@nestjs/common';
import { StatusRepository } from './status.repository';
@Injectable()
export class StatusService {
  constructor(private readonly repository: StatusRepository) {}
  health() {
    return { status: 'ok' };
  }
  async ready() {
    await this.repository.ready();
    return { status: 'ok' };
  }
  dashboard() {
    return this.repository.dashboard();
  }
}
