import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Decimal, Id, Text } from '../../common/validation';
export class PurchaseItem {
  @Id() idRepuesto!: number;
  @Id() cantidad!: number;
  @Decimal() costoUnitario!: string;
}
export class PurchaseInput {
  @Id() idProveedor!: number;
  @Id() idBodegaDestino!: number;
  @Text(40, true, true) numeroDocumentoProveedor?: string | null;
  @Text(500, true, true) observaciones?: string | null;
  @ApiProperty({ type: [PurchaseItem], minItems: 1, maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique((item: PurchaseItem) => item?.idRepuesto)
  @Type(() => PurchaseItem)
  @ValidateNested({ each: true })
  items!: PurchaseItem[];
}
