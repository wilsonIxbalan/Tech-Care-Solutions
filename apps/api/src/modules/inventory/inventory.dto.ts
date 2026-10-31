import { Choice, Id, Text } from '../../common/validation';
export class AdjustmentInput {
  @Id() idBodega!: number;
  @Id() idRepuesto!: number;
  @Choice(['AJUSTE_ENTRADA', 'AJUSTE_SALIDA']) codigoTipoMovimiento!: string;
  @Id() cantidad!: number;
  @Text(300) observacion!: string;
}
export class MinimumInput {
  @Id(false, 0) stockMinimo!: number;
}
