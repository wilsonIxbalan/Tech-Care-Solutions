import { resolve } from 'node:path';
export const envPaths = [
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(process.cwd(), '.env'),
];
export function validateEnvironment(env: Record<string, unknown>) {
  const secret = String(env.JWT_SECRET ?? '');
  if (secret.length < 32)
    throw new Error(
      'JWT_SECRET debe contener al menos 32 caracteres. Configura apps/api/.env.',
    );
  const origin = String(env.FRONTEND_ORIGIN ?? 'http://localhost:5173');
  for (const item of origin.split(',')) {
    const url = new URL(item.trim());
    if (
      url.origin !== item.trim() ||
      !['http:', 'https:'].includes(url.protocol)
    )
      throw new Error(
        'FRONTEND_ORIGIN debe contener orígenes exactos separados por coma.',
      );
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT no es válido.');
  const dbPort = Number(env.DB_PORT ?? 1433);
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535)
    throw new Error('DB_PORT no es válido.');
  if (
    env.NODE_ENV &&
    !['development', 'test', 'production'].includes(String(env.NODE_ENV))
  )
    throw new Error('NODE_ENV debe ser development, test o production.');
  for (const key of ['DB_ENCRYPT', 'DB_TRUST_SERVER_CERTIFICATE'])
    if (env[key] !== undefined && !['true', 'false'].includes(String(env[key])))
      throw new Error(`${key} debe ser true o false.`);
  if (env.JWT_EXPIRES_IN && env.JWT_EXPIRES_IN !== '1h')
    throw new Error('El contrato requiere JWT_EXPIRES_IN=1h.');
  if (
    env.NODE_ENV === 'production' &&
    (env.DB_ENCRYPT === 'false' || env.DB_TRUST_SERVER_CERTIFICATE === 'true')
  )
    throw new Error(
      'Producción requiere SQL cifrado y certificado verificado.',
    );
  return { ...env, JWT_SECRET: secret, FRONTEND_ORIGIN: origin, PORT: port };
}
