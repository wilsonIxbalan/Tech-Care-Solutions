import { Matches } from 'class-validator';
import { Choice, CivilDate, Decimal, Id, Text } from '../../common/validation';
export class OrderInput {
  @Id() idCliente!: number;
  @Id() idEquipo!: number;
  @Id() idPrioridad!: number;
  @Text(1000) problemaReportado!: string;
  @CivilDate(true, true) fechaEstimada?: string | null;
  @Text(500, true, true) observaciones?: string | null;
}
export class DiagnosisInput {
  @Text(1000) descripcion!: string;
  @Decimal() costoManoObraEstimado!: string;
}
export class RepairInput {
  @Text(1000) descripcion!: string;
  @Decimal() costoManoObra!: string;
}
export class FinishInput {
  @Text(500, true, true) observacion?: string | null;
}
export class ActivityInput {
  @Text(500) descripcion!: string;
  @Decimal(false, true, false, true) horasInvertidas!: string;
}
export class ConsumptionInput {
  @Id() idBodega!: number;
  @Id() idRepuesto!: number;
  @Id() cantidad!: number;
}
export class StateInput {
  @Choice(['DIAGNOSTICO', 'REPARACION', 'CANCELADO']) estado!: string;
  @Text(500) observacion!: string;
}
export class DeliveryInput {
  @Text(150)
  @Matches(/^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u, { message: 'El nombre solo puede tener letras, espacios, apóstrofo, punto y guion.' })
  nombreRecibe!: string;
  @Text(30, true, true)
  @Matches(/^\s*(?:\d\s*){13}$/, { message: 'Escribe un DPI de 13 dígitos (se permiten espacios).' })
  documentoRecibe?: string | null;
  @Text(500, true, true) observaciones?: string | null;
}
export class EmptyInput {}
