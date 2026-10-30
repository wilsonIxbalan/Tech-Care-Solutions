import { databaseDiagnostics, databaseUnavailable } from '../../../src/database/database-diagnostics';
import { validateEnvironment } from '../../../src/common/config';

describe('Diagnostico SQL sin datos sensibles', () => {
  it.each([
    [40615, 'firewall'], [18456, 'sql-authentication'], [4060, 'sql-authentication'],
    [40613, 'sql-unavailable'], [40501, 'sql-unavailable'],
  ])('clasifica numero SQL %s sin copiar el mensaje', (number, category) => {
    const error = { code: 'ELOGIN', message: 'password=CANARY', originalError: { info: { number, message: 'SQL PRIVADO' } } };
    expect(databaseDiagnostics(error)).toEqual({ driverCode: 'ELOGIN', sqlNumber: number, category });
    expect(databaseUnavailable(error)).toBe(true);
    expect(JSON.stringify(databaseDiagnostics(error))).not.toMatch(/CANARY|PRIVADO|password/);
  });
  it('limita recorrido, evita ciclos y no copia codigos desconocidos', () => {
    const cycle: Record<string, unknown> = { code: 'secreto-no-enumerado', number: NaN };
    cycle.cause = cycle;
    expect(databaseDiagnostics(cycle)).toEqual({ driverCode: undefined, sqlNumber: undefined, category: 'unknown' });
    expect(databaseUnavailable(cycle)).toBe(false);
  });
  it('distingue timeout, transporte y error de negocio sin sugerir reintento de escritura', () => {
    expect(databaseDiagnostics({ code: 'ETIMEOUT' }).category).toBe('timeout');
    expect(databaseUnavailable({ code: 'ECONNRESET' })).toBe(true);
    expect(databaseUnavailable({ code: 'EREQUEST', number: 51105 })).toBe(false);
    expect(databaseDiagnostics({ cause: { code: 'EREQUEST', number: 51105 } }).sqlNumber).toBe(51105);
  });
  it.each(['', '0', '-1', 'NaN', '120001', '1500.5'])('rechaza timeout configurado invalido %j', value => {
    expect(() => validateEnvironment({ JWT_SECRET: 'x'.repeat(32), DB_CONNECTION_TIMEOUT_MS: value })).toThrow(/DB_CONNECTION_TIMEOUT_MS/);
    expect(() => validateEnvironment({ JWT_SECRET: 'x'.repeat(32), DB_REQUEST_TIMEOUT_MS: value })).toThrow(/DB_REQUEST_TIMEOUT_MS/);
  });
});
