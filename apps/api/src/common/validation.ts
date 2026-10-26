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
    IsString(),
    MinLength(1),
    MaxLength(length),
    ...(email ? [IsEmail()] : []),
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
    IsInt(),
    Min(minimum),
    Max(2147483647),
  );
}
export function Choice(values: readonly string[], optional = false) {
  return applyDecorators(
    ApiProperty({ enum: values, required: !optional }),
    ValidateIf((_o, v: unknown) => !(optional && v === undefined)),
    IsIn(values),
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
    IsString(),
    Matches(pattern),
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
    Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/),
    IsISO8601({ strict: true }),
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
    IsBoolean(),
  );
}
