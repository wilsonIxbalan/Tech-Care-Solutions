import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { map } from 'rxjs/operators';
import { sqlError } from './sql-errors';

export function requestContext(req: Request, res: Response, next: () => void) {
  const candidate = req.get('X-Request-Id');
  res.locals.requestId =
    candidate && /^[a-zA-Z0-9_-]{8,80}$/.test(candidate)
      ? candidate
      : randomUUID();
  res.setHeader('X-Request-Id', res.locals.requestId as string);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value && typeof value === 'object' && 'data' in value) return value;
        return { data: value };
      }),
    );
  }
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    let status = 500;
    let error: Record<string, unknown> = {
      code: 'ERROR_INTERNO',
      message: 'Ocurrió un error interno.',
    };
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && 'code' in body)
        error = body as Record<string, unknown>;
      else
        error = {
          code:
            status === 404
              ? 'NO_ENCONTRADO'
              : status === 400
                ? 'VALIDACION'
                : 'ERROR_HTTP',
          message:
            status === 404
              ? 'El recurso no existe.'
              : 'No se pudo procesar la petición.',
        };
    } else if (exception && typeof exception === 'object') {
      if ('type' in exception && exception.type === 'entity.parse.failed') {
        status = 400;
        error = {
          code: 'VALIDACION',
          message: 'El cuerpo debe contener JSON válido.',
        };
      } else if ('type' in exception && exception.type === 'entity.too.large') {
        status = 413;
        error = {
          code: 'VALIDACION',
          message: 'La petición supera el tamaño permitido de 1 MB.',
        };
      }
      const sql =
        'number' in exception && typeof exception.number === 'number'
          ? sqlError(exception.number)
          : undefined;
      if (sql) {
        status = sql.status;
        error = { code: sql.code, message: sql.message };
      } else if (
        'code' in exception &&
        [
          'ETIMEOUT',
          'ESOCKET',
          'ECONNCLOSED',
          'ENOTOPEN',
          'ELOGIN',
          'EINSTLOOKUP',
        ].includes(String(exception.code))
      ) {
        status = 503;
        error = {
          code: 'SERVICIO_NO_DISPONIBLE',
          message:
            'No se pudo confirmar la respuesta de la base de datos. Consulta el resultado antes de repetir una escritura.',
        };
      }
    }
    // No cuerpos, mensajes SQL, cookies, hashes ni cabeceras de autenticación en logs.
    this.logger.warn(
      JSON.stringify({
        requestId: response.locals.requestId,
        method: request.method,
        path: request.path,
        status,
        code: error.code,
      }),
    );
    response
      .status(status)
      .json({ error, requestId: response.locals.requestId });
  }
}
