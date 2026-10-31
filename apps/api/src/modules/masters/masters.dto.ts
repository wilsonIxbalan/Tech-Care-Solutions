import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { validNit, phonePattern } from '../../common/client-validation';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ValidateBy,
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
  @Text(20)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @ValidateBy({ name: 'validNit', validator: { validate: validNit, defaultMessage: () => 'Escribe un NIT válido con su dígito verificador (por ejemplo, 1234567-9) o CF para consumidor final.' } })
  nit!: string;
  @Text(20)
  @Matches(phonePattern, { message: 'Escribe un teléfono de Guatemala de 8 dígitos, que inicie entre 2 y 7; puedes anteponer +502.' })
  telefono!: string;
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
  @Text(20)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @ValidateBy({ name: 'validNit', validator: { validate: validNit, defaultMessage: () => 'Escribe un NIT válido con su dígito verificador (por ejemplo, 1234567-9) o CF para consumidor final.' } })
  nit!: string;
  @Text(150) nombre!: string;
  @Text(20)
  @Matches(phonePattern, { message: 'Escribe un teléfono de Guatemala de 8 dígitos, que inicie entre 2 y 7; puedes anteponer +502.' })
  telefono!: string;
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
  @Text(20, true, true)
  @Matches(phonePattern, { message: 'Escribe un teléfono de Guatemala de 8 dígitos, que inicie entre 2 y 7; puedes anteponer +502.' })
  telefono?: string | null;
  @ApiProperty({
    type: String,
    format: 'password',
    minLength: 12,
    maxLength: 128,
  })
   @IsString({ message: 'Escribe una contraseña válida.' })
   @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres.' })
   @MaxLength(128, { message: 'La contraseña admite como máximo 128 caracteres.' })
  password!: string;
  @BooleanField() activo?: boolean;
  @ApiProperty({
    type: [String],
    enum: ['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'BODEGA', 'CAJA'],
  })
  @IsArray({ message: 'Selecciona los roles del usuario.' })
  @ArrayNotEmpty({ message: 'Selecciona al menos un rol.' })
  @ArrayUnique({ message: 'No repitas un rol en la selección.' })
  @IsIn(['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'BODEGA', 'CAJA'], {
    each: true,
    message: 'Selecciona únicamente roles válidos.',
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
