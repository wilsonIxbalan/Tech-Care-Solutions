import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ApiError } from '../../common/api-error';
import { AuthService } from './auth.service';
import { SessionUser } from './auth.dto';
export type AuthRequest = Request & { user: SessionUser };
export const Public = () => SetMetadata('public', true);
// Any permission from the list; a role restriction, when present, is additional.
export const Permissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata('permissions', permissions),
    ApiExtension('x-permissions-any', permissions),
  );
export const Roles = (...roles: string[]) =>
  applyDecorators(
    SetMetadata('roles', roles),
    ApiExtension('x-roles-any', roles),
  );
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
export const cookieName = (production: boolean) =>
  production ? '__Host-techcare_session' : 'techcare_session';
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const allowed = this.config
        .getOrThrow<string>('FRONTEND_ORIGIN')
        .split(',')
        .map((value) => value.trim());
      if (!req.get('Origin') || !allowed.includes(req.get('Origin')!))
        throw new ApiError(
          403,
          'ORIGEN_NO_PERMITIDO',
          'Entra desde la dirección autorizada para realizar esta petición.',
        );
      if (!req.is('application/json'))
        throw new ApiError(
          400,
          'VALIDACION',
          'La petición debe usar Content-Type application/json.',
        );
    }
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets))
      return true;
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token =
      cookies?.[cookieName(this.config.get('NODE_ENV') === 'production')];
    req.user = await this.auth.authenticate(
      typeof token === 'string' ? token : undefined,
    );
    const permissions =
      this.reflector.getAllAndOverride<string[]>('permissions', targets) ?? [];
    const roles =
      this.reflector.getAllAndOverride<string[]>('roles', targets) ?? [];
    if (
      (permissions.length &&
        !permissions.some((permission) =>
          req.user.permisos.includes(permission),
        )) ||
      (roles.length && !roles.some((role) => req.user.roles.includes(role)))
    )
      throw new ApiError(
        403,
        'PERMISO_DENEGADO',
        'No tienes permiso para esta acción.',
      );
    return true;
  }
}
