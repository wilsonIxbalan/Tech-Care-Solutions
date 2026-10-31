import { Injectable } from '@nestjs/common';
import { ApiError, invalid } from '../../common/api-error';
import { OrderQuery } from '../../common/query.dto';
import { ReadRepository } from '../../database/read.repository';
import { SessionUser } from '../auth/auth.dto';
import {
  ActivityInput,
  ConsumptionInput,
  DeliveryInput,
  DiagnosisInput,
  FinishInput,
  OrderInput,
  RepairInput,
  StateInput,
} from './service.dto';
import { ServiceRepository } from './service.repository';
@Injectable()
export class ServiceService {
  constructor(
    private readonly repository: ServiceRepository,
    private readonly reads: ReadRepository,
  ) {}
  list(query: OrderQuery) {
    return this.reads.list('ordenes', query);
  }
  detail(id: number) {
    return this.reads.orderDetail(id);
  }
  create(dto: OrderInput, user: SessionUser) {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
    if (dto.fechaEstimada && dto.fechaEstimada < today) {
      throw invalid('fechaEstimada', `No puedes agendar la entrega para ${dto.fechaEstimada}: es anterior a hoy (${today}, hora de Guatemala). Selecciona hoy o una fecha posterior.`);
    }
    return this.repository.create(dto, user.idUsuario);
  }
  diagnosis(id: number, dto: DiagnosisInput, user: SessionUser) {
    return this.repository.diagnosis(id, dto, user.idUsuario);
  }
  repair(id: number, dto: RepairInput, user: SessionUser) {
    return this.repository.repair(id, dto, user.idUsuario);
  }
  finish(id: number, dto: FinishInput, user: SessionUser) {
    return this.repository.finish(id, dto, user.idUsuario);
  }
  activity(id: number, dto: ActivityInput, user: SessionUser) {
    return this.repository.activity(id, dto, user.idUsuario);
  }
  consume(id: number, dto: ConsumptionInput, user: SessionUser) {
    return this.repository.consume(id, dto, user.idUsuario);
  }
  state(id: number, dto: StateInput, user: SessionUser) {
    const allowed =
      dto.estado === 'CANCELADO'
        ? ['RECEPCION', 'ADMINISTRADOR']
        : dto.estado === 'DIAGNOSTICO'
          ? ['RECEPCION', 'TECNICO', 'ADMINISTRADOR']
          : ['TECNICO', 'ADMINISTRADOR'];
    if (!allowed.some((role) => user.roles.includes(role)))
      throw new ApiError(
        403,
        'PERMISO_DENEGADO',
        'No tienes permiso para cambiar a ese estado.',
      );
    return this.repository.state(id, dto, user.idUsuario);
  }
  delivery(id: number, dto: DeliveryInput, user: SessionUser) {
    return this.repository.delivery(id, dto, user.idUsuario);
  }
}
