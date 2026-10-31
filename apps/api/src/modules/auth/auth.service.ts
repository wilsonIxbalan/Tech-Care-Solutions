import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ApiError } from '../../common/api-error';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './auth.dto';
import { LoginLimiter } from './login-limiter';
@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash(
    'dummy-value-never-used-as-a-credential',
    { type: argon2.argon2id },
  );
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly limiter: LoginLimiter,
  ) {}
  async login(dto: LoginDto) {
    this.limiter.consume(dto.nombreUsuario);
    const row = await this.repository.credentials(dto.nombreUsuario);
    const hash = row ? String(row.PasswordHash) : await this.dummyHash;
    const valid =
      hash.startsWith('$argon2id$') &&
      (await argon2.verify(hash, dto.password).catch(() => false));
    if (!row || !valid || !row.Activo)
      throw new ApiError(
        401,
        'CREDENCIALES_INVALIDAS',
        'Usuario o contraseña incorrectos.',
      );
    const session = await this.repository.session(Number(row.IdUsuario));
    if (!session?.active)
      throw new ApiError(
        401,
        'CREDENCIALES_INVALIDAS',
        'Usuario o contraseña incorrectos.',
      );
    await this.repository.accessed(session.user.idUsuario);
    const token = await this.jwt.signAsync(
      {},
      {
        subject: String(session.user.idUsuario),
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: 3600,
        algorithm: 'HS256',
        issuer: 'techcare-api',
        audience: 'techcare-web',
      },
    );
    return { token, usuario: session.user, expiresIn: 3600 };
  }
  async authenticate(token: string | undefined) {
    if (!token)
      throw new ApiError(
        401,
        'SESION_INVALIDA',
        'Inicia sesión para continuar.',
      );
    let id: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithms: ['HS256'],
        issuer: 'techcare-api',
        audience: 'techcare-web',
      });
      id = Number(payload.sub);
      if (!Number.isInteger(id) || id < 1 || id > 2147483647)
        throw new Error('sub inválido');
    } catch {
      throw new ApiError(
        401,
        'SESION_INVALIDA',
        'La sesión no es válida o ha expirado.',
      );
    }
    const session = await this.repository.session(id);
    if (!session)
      throw new ApiError(401, 'SESION_INVALIDA', 'La sesión no es válida.');
    if (!session.active)
      throw new ApiError(
        403,
        'USUARIO_INACTIVO',
        'El usuario está inactivo. Contacta a administración.',
      );
    return session.user;
  }
}
