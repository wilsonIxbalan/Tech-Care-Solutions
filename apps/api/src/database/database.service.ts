import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { ApiError } from '../common/api-error';
import { httpContext } from '../common/request-context';
import { databaseDiagnostics } from './database-diagnostics';

export type Row = Record<string, unknown>;
export type SqlType = sql.ISqlType | (() => sql.ISqlType);
export type Param = { name: string; type: SqlType; value: unknown };
export const param = (name: string, type: SqlType, value: unknown): Param => ({
  name,
  type,
  value: value ?? null,
});
export const int = (name: string, value: unknown) =>
  param(name, sql.Int, value);
export const text = (name: string, length: number, value: unknown) =>
  param(name, sql.VarChar(length), value);
export const money = (name: string, value: unknown, precision = 12) =>
  param(name, sql.Decimal(precision, 2), value);
const sessionOptions =
  'SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF; SET XACT_ABORT ON;';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private pending?: Promise<sql.ConnectionPool>;
  private current?: sql.ConnectionPool;
  private stopping = false;
  private readonly logger = new Logger('SQL');
  constructor(private readonly config: ConfigService) {}
  async pool() {
    if (this.stopping)
      throw new ApiError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio se está cerrando.');
    if (this.pending) return this.pending;
    if (this.current?.connected) return this.current;
    // Una promesa resuelta de un pool cerrado no es una conexion reutilizable.
    // Solo una llamada crea el reemplazo; nunca se reejecuta la consulta fallida.
    const connecting = this.connect();
    this.pending = connecting;
    try {
      return await connecting;
    } finally {
      if (this.pending === connecting) this.pending = undefined;
    }
  }
  private warn(operation: string, error: unknown, started: number, contextual = true) {
    this.logger.warn(JSON.stringify({
      ...(contextual ? httpContext.getStore() : undefined),
      operation, durationMs: Math.max(0, Date.now() - started),
      ...databaseDiagnostics(error),
    }));
  }
  private async connect() {
    const stale = this.current;
    this.current = undefined;
    if (stale) await stale.close().catch(error => this.warn('close', error, Date.now()));
    const server = this.config.get<string>('DB_SERVER');
    const database = this.config.get<string>('DB_NAME');
    const user = this.config.get<string>('DB_USER');
    const password = this.config.get<string>('DB_PASSWORD');
    if (!server || !database || !user || !password)
      throw new ApiError(
        503,
        'SERVICIO_NO_DISPONIBLE',
        'Falta configurar la conexión SQL del backend.',
      );
    const pool = new sql.ConnectionPool({
      server, database, user, password,
      port: Number(this.config.get('DB_PORT') ?? 1433),
      connectionTimeout: Number(this.config.get('DB_CONNECTION_TIMEOUT_MS') ?? 60000),
      requestTimeout: Number(this.config.get('DB_REQUEST_TIMEOUT_MS') ?? 60000),
      pool: { min: 0, max: 5, idleTimeoutMillis: 30000 },
      options: {
        encrypt: this.config.get('DB_ENCRYPT') !== 'false',
        trustServerCertificate: this.config.get('DB_TRUST_SERVER_CERTIFICATE') === 'true',
        useUTC: true,
        enableArithAbort: true,
      },
    });
    pool.on('error', (error: unknown) => {
      // mssql retira conexiones rotas. Un evento no demuestra que todo el pool
      // este cerrado; no interrumpir transacciones ni destruir un pool sano.
      this.warn('pool', error, Date.now(), false);
    });
    const started = Date.now();
    try {
      await pool.connect();
      if (this.stopping) {
        throw new ApiError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio se está cerrando.');
      }
      this.current = pool;
      return pool;
    } catch (error) {
      this.warn('connect', error, started);
      await pool.close().catch(() => undefined);
      throw new ApiError(
        503,
        'SERVICIO_NO_DISPONIBLE',
        'No se pudo conectar a SQL Server.',
        undefined,
        error,
      );
    }
  }
  request(
    connection: sql.ConnectionPool | sql.Transaction,
    params: Param[] = [],
  ) {
    const request = connection.request();
    for (const p of params) request.input(p.name, p.type, p.value);
    return request;
  }
  async query(statement: string, params: Param[] = [], tx?: sql.Transaction) {
    const request = this.request(tx ?? (await this.pool()), params);
    const started = Date.now();
    try {
      return await request.query<Row>(`${sessionOptions}\n${statement}`);
    } catch (error) {
      this.warn('query', error, started);
      throw error;
    }
  }
  async execute(
    procedure: string,
    params: Param[] = [],
    outputs: string[] = [],
    tx?: sql.Transaction,
  ): Promise<sql.IProcedureResult<Row>> {
    // Una transacción fija la conexión para SET + EXEC; los SP reutilizan la transacción exterior.
    if (!tx)
      return this.transaction((connection) =>
        this.execute(procedure, params, outputs, connection),
      );
    await this.query('SELECT 1 AS SessionReady;', [], tx);
    const request = this.request(tx, params);
    for (const output of outputs) request.output(output, sql.Int);
    const started = Date.now();
    try {
      return await request.execute<Row>(procedure);
    } catch (error) {
      this.warn('execute', error, started);
      throw error;
    }
  }
  async transaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(await this.pool());
    let rolledBack = false;
    tx.on('rollback', () => {
      rolledBack = true;
    });
    const started = Date.now();
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    } catch (error) {
      this.warn('begin', error, started);
      throw error;
    }
    try {
      const result = await work(tx);
      const committing = Date.now();
      try { await tx.commit(); } catch (error) {
        this.warn('commit', error, committing);
        throw error;
      }
      return result;
    } catch (error) {
      if (!rolledBack) await tx.rollback().catch(rollbackError => this.warn('rollback', rollbackError, Date.now()));
      throw error;
    }
  }
  async onApplicationShutdown() {
    this.stopping = true;
    await this.pending?.catch(() => undefined);
    const pool = this.current;
    this.current = undefined;
    if (pool) await pool.close().catch(error => this.warn('close', error, Date.now(), false));
  }
}
