import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Text } from '../../common/validation';
export class LoginDto {
  // Se conserva el nombre del campo: admite nombre de usuario o correo.
  @Text(120) nombreUsuario!: string;
  @ApiProperty({ type: String, format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
export interface SessionUser {
  idUsuario: number;
  nombreUsuario: string;
  nombreCompleto: string;
  roles: string[];
  permisos: string[];
}
