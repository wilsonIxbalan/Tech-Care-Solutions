import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../../../src/database/database.service';
import { httpContext } from '../../../src/common/request-context';

jest.mock('mssql', () => ({
  ConnectionPool: jest.fn(), Transaction: jest.fn(), ISOLATION_LEVEL: { SERIALIZABLE: 4 },
}));

function fakePool() {
  const events = new Map<string, (error: unknown) => void>();
  const request = { input: jest.fn(), output: jest.fn(), query: jest.fn().mockResolvedValue({ recordset: [] }), execute: jest.fn().mockResolvedValue({ recordsets: [] }) };
  const pool = {
    connected: false,
    connect: jest.fn<Promise<unknown>, []>(),
    close: jest.fn(async () => { pool.connected = false; }),
    on: jest.fn((event: string, listener: (error: unknown) => void) => { events.set(event, listener); }),
    request: jest.fn(() => request),
  };
  pool.connect.mockImplementation(async () => { pool.connected = true; return pool; });
  return { pool, request, events };
}
const config = () => new ConfigService({ DB_SERVER: 'example.invalid', DB_NAME: 'TestOnly', DB_USER: 'test', DB_PASSWORD: 'PRIVATE-CANARY' });

describe('Pool SQL: recuperacion sin reejecucion de operaciones', () => {
  let logs: jest.SpyInstance;
  beforeEach(() => { jest.clearAllMocks(); logs = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());

  it('coordina peticiones iniciales y reutiliza el pool conectado', async () => {
    const { pool } = fakePool();
    let resolve!: (value: typeof pool) => void;
    pool.connect.mockImplementation(() => new Promise(done => { resolve = done; }));
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => pool);
    const db = new DatabaseService(config());
    const one = db.pool(); const two = db.pool();
    expect(pool.connect).toHaveBeenCalledTimes(1);
    pool.connected = true; resolve(pool);
    expect(await one).toBe(pool); expect(await two).toBe(pool);
    expect(await db.pool()).toBe(pool);
    expect(sql.ConnectionPool).toHaveBeenCalledTimes(1);
  });

  it('tras rechazo inicial permite un nuevo intento, preserva causa y oculta secretos', async () => {
    const first = fakePool(); const second = fakePool();
    const failure = { code: 'ELOGIN', originalError: { info: { number: 40615, message: 'PRIVATE-CANARY SQL texto' } } };
    first.pool.connect.mockRejectedValue(failure);
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementationOnce(() => first.pool).mockImplementationOnce(() => second.pool);
    const db = new DatabaseService(config());
    await httpContext.run({ requestId: 'request-test-123' }, async () => {
      await expect(db.pool()).rejects.toMatchObject({ cause: failure });
    });
    expect(first.pool.close).toHaveBeenCalledTimes(1);
    expect(logs).toHaveBeenCalledWith(expect.stringContaining('request-test-123'));
    expect(logs).toHaveBeenCalledWith(expect.stringContaining('"category":"firewall"'));
    expect(JSON.stringify(logs.mock.calls)).not.toContain('PRIVATE-CANARY');
    expect(await db.pool()).toBe(second.pool);
  });

  it('reemplaza un pool cerrado una sola vez aun con llamadas concurrentes', async () => {
    const first = fakePool(); const second = fakePool();
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementationOnce(() => first.pool).mockImplementationOnce(() => second.pool);
    const db = new DatabaseService(config());
    await db.pool(); first.pool.connected = false;
    const [one, two] = await Promise.all([db.pool(), db.pool()]);
    expect(one).toBe(second.pool); expect(two).toBe(second.pool);
    expect(first.pool.close).toHaveBeenCalledTimes(1);
    expect(second.pool.connect).toHaveBeenCalledTimes(1);
  });

  it('un timeout no repite una escritura ni destruye conexiones sanas', async () => {
    const { pool, request } = fakePool();
    const failure = { code: 'ETIMEOUT', message: 'PRIVATE-CANARY' };
    request.query.mockRejectedValueOnce(failure);
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => pool);
    const db = new DatabaseService(config());
    await expect(db.query('INSERT test_only')).rejects.toBe(failure);
    expect(request.query).toHaveBeenCalledTimes(1);
    expect(pool.close).not.toHaveBeenCalled();
    await db.query('SELECT test_only');
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs.mock.calls)).not.toMatch(/PRIVATE-CANARY|INSERT test_only/);
  });

  it('registra eventos del driver sin atribuirlos a un request antiguo ni cerrar todo el pool', async () => {
    const { pool, events } = fakePool();
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => pool);
    const db = new DatabaseService(config()); await db.pool();
    httpContext.run({ requestId: 'old-request' }, () => events.get('error')!({ code: 'ESOCKET', message: 'PRIVATE-CANARY' }));
    expect(await db.pool()).toBe(pool);
    expect(pool.close).not.toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toMatch(/old-request|PRIVATE-CANARY/);
  });

  it('un commit fallido no repite el trabajo y conserva el fallo original', async () => {
    const { pool } = fakePool();
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => pool);
    const failure = { code: 'ESOCKET' };
    const tx = { on: jest.fn(), begin: jest.fn().mockResolvedValue(undefined), commit: jest.fn().mockRejectedValue(failure), rollback: jest.fn().mockRejectedValue(new Error('PRIVATE-CANARY')) };
    (sql.Transaction as unknown as jest.Mock).mockImplementation(() => tx);
    const db = new DatabaseService(config()); const work = jest.fn().mockResolvedValue('done');
    await expect(db.transaction(work)).rejects.toBe(failure);
    expect(work).toHaveBeenCalledTimes(1); expect(tx.commit).toHaveBeenCalledTimes(1); expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs.mock.calls)).not.toContain('PRIVATE-CANARY');
  });

  it('cierra sin propagar un connect rechazado y rechaza trabajo nuevo al detenerse', async () => {
    const { pool } = fakePool(); pool.connect.mockRejectedValue({ code: 'ESOCKET' });
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => pool);
    const db = new DatabaseService(config()); await expect(db.pool()).rejects.toBeDefined();
    await expect(db.onApplicationShutdown()).resolves.toBeUndefined();
    await expect(db.pool()).rejects.toMatchObject({ status: 503 });
  });

  it('cerrar durante connect espera y libera la conexion sin publicarla', async () => {
    const { pool } = fakePool(); let resolve!: (value: typeof pool) => void;
    pool.connect.mockImplementation(() => new Promise(done => { resolve = done; }));
    (sql.ConnectionPool as unknown as jest.Mock).mockImplementation(() => pool);
    const db = new DatabaseService(config()); const connecting = db.pool();
    const rejected = expect(connecting).rejects.toMatchObject({ status: 503 });
    const closing = db.onApplicationShutdown(); pool.connected = true; resolve(pool);
    await rejected; await closing;
    expect(pool.close).toHaveBeenCalledTimes(1);
  });
});
