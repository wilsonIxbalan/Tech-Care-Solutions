import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateBy,
} from 'class-validator';

export function Text(
  length: number,
  optional = false,
  nullable = false,
  email = false,
) {
  return applyDecorators(
    ApiProperty({
      type: String,
      maxLength: length,
      required: !optional,
      nullable,
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? value.trim() === '' && nullable
          ? null
          : value.trim()
        : value,
    ),
    ValidateIf(
      (_object, value: unknown) =>
        !(optional && value === undefined) && !(nullable && value === null),
    ),
    IsString({ message: 'Escribe un texto válido.' }),
    MinLength(1, { message: 'Este campo no puede quedar vacío.' }),
    MaxLength(length, { message: `Usa como máximo ${length} caracteres.` }),
    ValidateBy({
      name: 'safeText',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && Array.from(value).every(character => {
          const code = character.charCodeAt(0);
          // Se conservan saltos de linea y tabulacion de direcciones/descripciones.
          return !((code < 32 && ![9, 10, 13].includes(code)) || (code >= 127 && code <= 159));
        }),
        defaultMessage: () => 'El texto contiene caracteres de control no permitidos.',
      },
    }),
    ...(email ? [IsEmail({}, { message: 'Escribe un correo electrónico válido.' })] : []),
  );
}
export function Id(optional = false, minimum = 1, query = false) {
  return applyDecorators(
    ApiProperty({
      type: Number,
      minimum,
      maximum: 2147483647,
      required: !optional,
    }),
    ...(query
      ? [
          Transform(({ value }: { value: unknown }) =>
            typeof value === 'string' && /^\d+$/.test(value)
              ? Number(value)
              : value,
          ),
        ]
      : []),
    ValidateIf((_object, value: unknown) => !(optional && value === undefined)),
    IsInt({ message: 'Indica un número entero válido.' }),
    Min(minimum, { message: `El valor mínimo es ${minimum}.` }),
    Max(2147483647, { message: 'El valor supera el máximo permitido de 2147483647.' }),
  );
}
export function Choice(values: readonly string[], optional = false) {
  return applyDecorators(
    ApiProperty({ enum: values, required: !optional }),
    ValidateIf((_o, v: unknown) => !(optional && v === undefined)),
    IsIn(values, { message: 'Selecciona una opción válida.' }),
  );
}
export function Decimal(
  optional = false,
  positive = false,
  percentage = false,
  hours = false,
) {
  const pattern = percentage
    ? /^(?:(?:0|[1-9]\d?)\.\d{2}|100\.00)$/
    : hours
      ? /^(?:0|[1-9]\d{0,2})\.\d{2}$/
      : /^(?:0|[1-9]\d{0,9})\.\d{2}$/;
  return applyDecorators(
    ApiProperty({
      type: String,
      example: percentage ? '12.00' : '125.50',
      required: !optional,
      pattern: pattern.source,
    }),
    ValidateIf((_o, v: unknown) => !(optional && v === undefined)),
    IsString({ message: 'Escribe el importe como texto decimal.' }),
    Matches(pattern, { message: percentage ? 'Indica un porcentaje entre 0.00 y 100.00, con dos decimales.'
      : hours ? 'Indica horas entre 0.01 y 999.99, con dos decimales.'
        : 'Indica un importe no negativo válido, con dos decimales.' }),
    ...(positive
      ? [
          Matches(/^(?!0\.00$)/, {
            message: 'El valor debe ser mayor que cero.',
          }),
        ]
      : []),
  );
}
export function CivilDate(optional = true, nullable = false) {
  return applyDecorators(
    ApiProperty({
      type: String,
      format: 'date',
      required: !optional,
      nullable,
    }),
    ValidateIf(
      (_o, v: unknown) =>
        !(optional && v === undefined) && !(nullable && v === null),
    ),
    Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/, { message: 'Indica una fecha válida en formato AAAA-MM-DD.' }),
    IsISO8601({ strict: true }, { message: 'La fecha indicada no existe.' }),
  );
}
export function BooleanField(optional = true, query = false) {
  return applyDecorators(
    ApiProperty({ type: Boolean, required: !optional }),
    ...(query
      ? [
          Transform(({ value }: { value: unknown }) =>
            value === 'true' ? true : value === 'false' ? false : value,
          ),
        ]
      : []),
    ValidateIf((_o, v: unknown) => !(optional && v === undefined)),
    IsBoolean({ message: 'Selecciona un valor de verdadero o falso.' }),
  );
}
