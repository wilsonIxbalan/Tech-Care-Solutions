import { HttpException } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super({ code, message, ...(details ? { details } : {}) }, status);
  }
}
export const notFound = () =>
  new ApiError(
    404,
    'NO_ENCONTRADO',
    'El registro no existe o ya no está disponible.',
  );
export const invalid = (field: string, message: string) =>
  new ApiError(400, 'VALIDACION', 'Revisa los campos indicados.', {
    [field]: [message],
  });
