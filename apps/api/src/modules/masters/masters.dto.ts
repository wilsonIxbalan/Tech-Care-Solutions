import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  BooleanField,
  Choice,
  Decimal,
  Id,
  Text,
} from '../../common/validation';
export class ClientInput {
  @Choice(['INDIVIDUAL', 'EMPRESARIAL']) tipoCliente!: string;
  @Text(20) nit!: string;
  @Text(20) telefono!: string;
  @Text(100, true, true) nombres?: string | null;
  @Text(100, true, true) apellidos?: string | null;
  @Text(150, true, true) razonSocial?: string | null;
  @Text(120, true, true) nombreContacto?: string | null;
  @Text(120, true, true, true) email?: string | null;
  @Text(250, true, true) direccion?: string | null;
  @Choice(['ACTIVO', 'INACTIVO'], true) estado?: string;
}
export class ClientPatch extends PartialType(ClientInput, {
  skipNullProperties: false,
}) {}
export class EquipmentInput {
  @Id() idCliente!: number;
  @Id() idTipoEquipo!: number;
  @Id() idMarca!: number;
  @Text(80) modelo!: string;
  @Text(60) numeroSerie!: string;
  @Text(300) descripcion!: string;
  @Choice(['ACTIVO', 'INACTIVO', 'BAJA'], true) estado?: string;
}
export class EquipmentPatch extends PartialType(EquipmentInput, {
  skipNullProperties: false,
}) {}
export class PartInput {
  @Id() idCategoria!: number;
  @Text(30) codigo!: string;
  @Text(120) nombre!: string;
  @Text(300, true, true) descripcion?: string | null;
  @Decimal() precioCompraReferencia!: string;
  @Decimal() precioVenta!: string;
  @Choice(['ACTIVO', 'INACTIVO'], true) estado?: string;
}
export class PartPatch extends PartialType(PartInput, {
  skipNullProperties: false,
}) {}
export class SupplierInput {
  @Text(20) nit!: string;
  @Text(150) nombre!: string;
  @Text(20) telefono!: string;
  @Text(120, true, true) nombreContacto?: string | null;
  @Text(120, true, true, true) email?: string | null;
  @Text(250, true, true) direccion?: string | null;
  @Choice(['ACTIVO', 'INACTIVO'], true) estado?: string;
}
export class SupplierPatch extends PartialType(SupplierInput, {
  skipNullProperties: false,
}) {}
export class WarehouseInput {
  @Text(20) codigo!: string;
  @Text(80) nombre!: string;
  @Text(200, true, true) ubicacion?: string | null;
  @Choice(['ACTIVA', 'INACTIVA'], true) estado?: string;
}
export class WarehousePatch extends PartialType(WarehouseInput, {
  skipNullProperties: false,
}) {}
export class UserInput {
  @Text(50) nombreUsuario!: string;
  @Text(150) nombreCompleto!: string;
  @Text(120, false, false, true) email!: string;
  @Text(20, true, true) telefono?: string | null;
  @ApiProperty({
    type: String,
    format: 'password',
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
  @BooleanField() activo?: boolean;
  @ApiProperty({
    type: [String],
    enum: ['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'BODEGA', 'CAJA'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'BODEGA', 'CAJA'], {
    each: true,
  })
  roles!: string[];
}
export class UserPatch extends PartialType(UserInput, {
  skipNullProperties: false,
}) {}
export class CatalogInput {
  @Text(80) nombre!: string;
  @Text(200, true, true) descripcion?: string | null;
  @Text(20, true) codigo?: string;
  @BooleanField() activo?: boolean;
}
export class CatalogPatch extends PartialType(CatalogInput, {
  skipNullProperties: false,
}) {}
