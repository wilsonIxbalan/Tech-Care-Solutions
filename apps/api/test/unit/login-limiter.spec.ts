import { LoginLimiter, loginLimit } from '../../src/modules/auth/login-limiter';

describe('Límite de login local', () => {
  beforeEach(() => { jest.useFakeTimers().setSystemTime(new Date('2026-01-01')); });
  afterEach(() => jest.useRealTimers());

  it('limita variantes del mismo identificador, pero no otras cuentas bajo un proxy', () => {
    const limiter = new LoginLimiter();
    for (let i = 0; i < loginLimit.attempts; i++) limiter.consume('  ÁDMIN@example.test ');
    expect(() => limiter.consume('admin@EXAMPLE.test')).toThrow(expect.objectContaining({ status: 429 }));
    expect(() => limiter.consume('otra@example.test')).not.toThrow();
  });

  it('caduca la ventana sin extenderla por intentos bloqueados', () => {
    const limiter = new LoginLimiter();
    for (let i = 0; i < loginLimit.attempts; i++) limiter.consume('admin');
    jest.advanceTimersByTime(loginLimit.windowMs - 1);
    expect(() => limiter.consume('admin')).toThrow();
    jest.advanceTimersByTime(1);
    expect(() => limiter.consume('admin')).not.toThrow();
  });

  it('mantiene memoria acotada, no bloquea globalmente y limpia entradas expiradas', () => {
    const limiter = new LoginLimiter();
    for (let i = 0; i < loginLimit.maxKeys + 50; i++) limiter.consume(`synthetic-${i}`);
    const entries = Reflect.get(limiter, 'entries') as Map<string, unknown>;
    expect(entries.size).toBe(loginLimit.maxKeys);
    expect([...entries.keys()].every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
    expect(() => limiter.consume('cuenta-legitima')).not.toThrow();
    jest.advanceTimersByTime(loginLimit.windowMs);
    limiter.consume('otra');
    expect(entries.size).toBe(1);
  });
});
