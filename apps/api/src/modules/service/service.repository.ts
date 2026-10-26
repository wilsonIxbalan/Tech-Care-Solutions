import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/api-error';
import * as sql from 'mssql';
import {
  DatabaseService,
  int,
  money,
  param,
  text,
} from '../../database/database.service';
import { ReadRepository } from '../../database/read.repository';
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
@Injectable()
export class ServiceRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly reads: ReadRepository,
  ) {}
  create(dto: OrderInput, actor: number) {
    return this.db.transaction(async (tx) => {
      const result = await this.db.execute(
        'dbo.sp_RegistrarOrdenServicio',
        [
          int('IdCliente', dto.idCliente),
          int('IdEquipo', dto.idEquipo),
          int('IdUsuarioRecepcion', actor),
          int('IdPrioridad', dto.idPrioridad),
          text('ProblemaReportado', 1000, dto.problemaReportado),
          param(
            'FechaEstimada',
            sql.Date,
            dto.fechaEstimada
              ? new Date(`${dto.fechaEstimada}T00:00:00Z`)
              : null,
          ),
          text('Observaciones', 500, dto.observaciones),
        ],
        ['IdOrden'],
        tx,
      );
      const order = await this.reads.one(
        'ordenes',
        Number(result.output.IdOrden),
        tx,
      );
      return {
        idOrden: order.idOrden,
        numeroOrden: order.numeroOrden,
        estado: order.estado,
      };
    });
  }
  diagnosis(id: number, dto: DiagnosisInput, actor: number) {
    return this.db.transaction(async (tx) => {
      const result = await this.db.execute(
        'dbo.sp_RegistrarDiagnostico',
        [
          int('IdOrden', id),
          int('IdTecnico', actor),
          text('Descripcion', 1000, dto.descripcion),
          money('CostoManoObraEstimado', dto.costoManoObraEstimado),
        ],
        ['IdDiagnostico'],
        tx,
      );
      return {
        idDiagnostico: result.output.IdDiagnostico as number,
        idOrden: id,
        estadoOrden: (await this.reads.one('ordenes', id, tx)).estado,
      };
    });
  }
  repair(id: number, dto: RepairInput, actor: number) {
    return this.db.transaction(async (tx) => {
      const result = await this.db.execute(
        'dbo.sp_IniciarReparacion',
        [
          int('IdOrden', id),
          int('IdTecnico', actor),
          text('Descripcion', 1000, dto.descripcion),
          money('CostoManoObra', dto.costoManoObra),
        ],
        ['IdReparacion'],
        tx,
      );
      const repair = await this.reads.repair(
        Number(result.output.IdReparacion),
        tx,
      );
      return {
        idReparacion: repair.idReparacion,
        idOrden: id,
        estado: repair.estado,
        estadoOrden: (await this.reads.one('ordenes', id, tx)).estado,
      };
    });
  }
  finish(id: number, dto: FinishInput, actor: number) {
    return this.db.transaction(async (tx) => {
      await this.db.execute(
        'dbo.sp_FinalizarReparacion',
        [
          int('IdReparacion', id),
          int('IdUsuario', actor),
          text('Observacion', 500, dto.observacion),
        ],
        [],
        tx,
      );
      const repair = await this.reads.repair(id, tx);
      return {
        idReparacion: id,
        estado: repair.estado,
        estadoOrden: (
          await this.reads.one('ordenes', Number(repair.idOrden), tx)
        ).estado,
      };
    });
  }
  async activity(id: number, dto: ActivityInput, actor: number) {
    const result = await this.db.execute(
      'dbo.usp_RegistrarActividad',
      [
        int('IdReparacion', id),
        int('IdTecnico', actor),
        text('Descripcion', 500, dto.descripcion),
        money('HorasInvertidas', dto.horasInvertidas, 5),
      ],
      ['IdActividad'],
    );
    return { idActividad: result.output.IdActividad as number };
  }
  consume(id: number, dto: ConsumptionInput, actor: number) {
    return this.db.transaction(async (tx) => {
      const result = await this.db.execute(
        'dbo.sp_AsignarRepuestoReparacion',
        [
          int('IdReparacion', id),
          int('IdBodega', dto.idBodega),
          int('IdRepuesto', dto.idRepuesto),
          int('Cantidad', dto.cantidad),
          int('IdUsuario', actor),
        ],
        ['IdRepuestoReparacion'],
        tx,
      );
      const movement = await this.db.query(
        'SELECT ExistenciaResultante FROM dbo.vw_MovimientosInventario WHERE IdRepuestoReparacion=@Id;',
        [int('Id', result.output.IdRepuestoReparacion)],
        tx,
      );
      return {
        idRepuestoReparacion: result.output.IdRepuestoReparacion as number,
        existenciaResultante: movement.recordset[0].ExistenciaResultante,
      };
    });
  }
  state(id: number, dto: StateInput, actor: number) {
    return this.db.transaction(async (tx) => {
      if (
        dto.estado === 'REPARACION' &&
        (await this.reads.one('ordenes', id, tx)).estado !== 'LISTO'
      )
        throw new ApiError(
          409,
          'TRANSICION_INVALIDA',
          'Este cambio de estado solo permite retrabajo desde LISTO; inicia una reparación para registrar un trabajo nuevo.',
        );
      await this.db.execute(
        'dbo.sp_CambiarEstadoOrden',
        [
          int('IdOrden', id),
          text('CodigoEstadoNuevo', 30, dto.estado),
          int('IdUsuario', actor),
          text('Observacion', 500, dto.observacion),
        ],
        [],
        tx,
      );
      return {
        idOrden: id,
        estado: (await this.reads.one('ordenes', id, tx)).estado,
      };
    });
  }
  delivery(id: number, dto: DeliveryInput, actor: number) {
    return this.db.transaction(async (tx) => {
      await this.db.execute(
        'dbo.sp_EntregarOrden',
        [
          int('IdOrden', id),
          int('IdUsuarioEntrega', actor),
          text('NombreRecibe', 150, dto.nombreRecibe),
          text('DocumentoRecibe', 30, dto.documentoRecibe),
          text('Observaciones', 500, dto.observaciones),
        ],
        [],
        tx,
      );
      const delivery = (
        await this.reads.children('entregas', 'IdOrden', id, tx)
      )[0];
      return {
        idEntrega: delivery.idEntrega,
        idOrden: id,
        estadoOrden: (await this.reads.one('ordenes', id, tx)).estado,
      };
    });
  }
}
