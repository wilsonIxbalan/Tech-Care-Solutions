import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { ApiError } from '../common/api-error';

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
  constructor(private readonly config: ConfigService) {}
  async pool() {
    if (!this.pending) {
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
        server,
        database,
        user,
        password,
        port: Number(this.config.get('DB_PORT') ?? 1433),
        connectionTimeout: 60000,
        requestTimeout: 60000,
        pool: { min: 0, max: 5, idleTimeoutMillis: 30000 },
        options: {
          encrypt: this.config.get('DB_ENCRYPT') !== 'false',
          trustServerCertificate:
            this.config.get('DB_TRUST_SERVER_CERTIFICATE') === 'true',
          useUTC: true,
          enableArithAbort: true,
        },
      });
      pool.on('error', () => {
        /* El siguiente request reporta el fallo mediante el filtro seguro. */
      });
      this.pending = pool.connect().catch(async () => {
        this.pending = undefined;
        await pool.close().catch(() => undefined);
        throw new ApiError(
          503,
          'SERVICIO_NO_DISPONIBLE',
          'No se pudo conectar a SQL Server.',
        );
      });
    }
    return this.pending;
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
    return request.query<Row>(`${sessionOptions}\n${statement}`);
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
    return request.execute<Row>(procedure);
  }
  async transaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(await this.pool());
    let rolledBack = false;
    tx.on('rollback', () => {
      rolledBack = true;
    });
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      if (!rolledBack) await tx.rollback().catch(() => undefined);
      throw error;
    }
  }
  async onApplicationShutdown() {
    if (this.pending) await (await this.pending).close();
  }
}
