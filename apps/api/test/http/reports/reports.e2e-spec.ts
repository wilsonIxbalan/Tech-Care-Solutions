import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ApiError } from '../../../src/common/api-error';
import { configureApp } from '../../../src/configure-app';
import { DatabaseService, Param } from '../../../src/database/database.service';
import { ReadRepository } from '../../../src/database/read.repository';
import { AccessGuard } from '../../../src/modules/auth/access';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { DownloadsController, FinancialExportGuard } from '../../../src/modules/downloads/downloads.controller';
import { DownloadsService } from '../../../src/modules/downloads/downloads.service';
import { ReportsController } from '../../../src/modules/reports/reports.controller';
import { ReportsRepository } from '../../../src/modules/reports/reports.repository';
import { ReportsService } from '../../../src/modules/reports/reports.service';

describe('Reportes HTTP: contrato SQL paginado (driver sustituido, sin Azure)', () => {
  let app: NestExpressApplication;
  let role = 'CAJA';
  const execute = jest.fn();
  const forbidden = jest.fn(() => { throw new Error('Conexion SQL prohibida en tests HTTP.'); });
  const binding = (name: string) => (execute.mock.calls[0][1] as Param[]).find(p => p.name === name)?.value;
  const get = (path: string) => request(app.getHttpServer()).get('/api/v1' + path).set('Cookie', 'techcare_session=valid');

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportsController, DownloadsController],
      providers: [
        ReportsService, ReportsRepository, DownloadsService, FinancialExportGuard,
        { provide: APP_GUARD, useClass: AccessGuard },
        { provide: ConfigService, useValue: new ConfigService({ NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173' }) },
        { provide: DatabaseService, useValue: { execute, query: forbidden, pool: forbidden, transaction: forbidden } },
        { provide: ReadRepository, useValue: { orderDetails: forbidden, orderDetail: forbidden, invoiceDetail: forbidden } },
        { provide: AuthService, useValue: { authenticate: async (token: string) => {
          if (token !== 'valid') throw new ApiError(401, 'SESION_INVALIDA', 'Inicia sesión.');
          return { idUsuario: 1, nombreUsuario: 'test', nombreCompleto: 'Prueba', roles: [role], permisos: ['REPORTES_VER'] };
        } } },
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app); await app.init();
  });
  beforeEach(() => { execute.mockReset(); role = 'CAJA'; });
  afterAll(async () => { await app.close(); expect(forbidden).not.toHaveBeenCalled(); });

  it('la pagina HTTP y su total corresponden a SQL, no a un slice de filas en Nest', async () => {
    execute.mockResolvedValue({ recordsets: [[{ IdRepuesto: 7, Nombre: 'Fila SQL' }], [{ TotalRows: 8 }]] });
    const result = await get('/reportes/inventario?page=3&pageSize=2&search=%C3%B1%25_').expect(200);
    expect(result.body).toEqual({ data: [{ idRepuesto: 7, nombre: 'Fila SQL' }], meta: { page: 3, pageSize: 2, total: 8, totalPages: 4 } });
    expect(binding('Page')).toBe(3); expect(binding('PageSize')).toBe(2); expect(binding('Search')).toBe('ñ%_');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('facturas entrega todos los pagos de su pagina y preserva conSaldo=false', async () => {
    execute.mockResolvedValue({ recordsets: [
      [{ IdFactura: 4, Total: 50 }], [{ IdPago: 6, IdFactura: 4, Monto: 10 }, { IdPago: 7, IdFactura: 4, Monto: 15 }], [{ TotalRows: 40 }],
    ] });
    const result = await get('/reportes/facturas-saldo?page=2&pageSize=1&conSaldo=false').expect(200);
    expect(result.body).toMatchObject({ data: [{ idFactura: 4, total: '50.00', pagos: [{ idPago: 6, monto: '10.00' }, { idPago: 7, monto: '15.00' }] }], meta: { page: 2, total: 40 } });
    expect(binding('ConSaldo')).toBe(false);
  });

  it('exportacion ignora pagina pero conserva search y exige tope global SQL', async () => {
    execute.mockResolvedValue({ recordsets: [[{ Nombre: 'ñ%_primero' }, { Nombre: 'ñ%_segundo' }, { Nombre: 'ñ%_tercero' }]] });
    const result = await get('/reportes/inventario/exportar?formato=csv&conjunto=1&page=999&pageSize=1&search=%C3%B1%25_').expect(200);
    expect(result.text).toContain('ñ%_primero'); expect(result.text).toContain('ñ%_tercero');
    expect(binding('Page')).toBeUndefined(); expect(binding('PageSize')).toBeUndefined();
    expect(binding('MaxRows')).toBe(10000); expect(binding('Search')).toBe('ñ%_');
  });

  it('el rechazo SQL de tamaño se conserva como 413, sin archivo parcial ni texto privado', async () => {
    execute.mockRejectedValue({ code: 'EREQUEST', number: 51710, message: 'PRIVATE-CANARY' });
    const result = await get('/reportes/inventario/exportar?formato=xlsx').expect(413);
    expect(result.body.error.code).toBe('EXPORTACION_DEMASIADO_GRANDE');
    expect(result.headers['content-disposition']).toBeUndefined();
    expect(JSON.stringify(result.body)).not.toContain('PRIVATE-CANARY');
  });

  it('procedimientos sin migrar producen un error seguro y no un fallback que cargue todo', async () => {
    execute.mockRejectedValue({ code: 'EREQUEST', number: 8144, message: 'PRIVATE-CANARY' });
    const result = await get('/reportes/inventario').expect(503);
    expect(result.body.error.message).toContain('procedimientos SQL');
    expect(JSON.stringify(result.body)).not.toContain('PRIVATE-CANARY');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each(['page=0', 'pageSize=101', 'MaxRows=999999', 'search=%00', 'adicional=si'])('rechaza %s antes de ejecutar', async query => {
    await get('/reportes/inventario?' + query).expect(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('autenticacion y rol financiero se verifican antes de SQL', async () => {
    await request(app.getHttpServer()).get('/api/v1/reportes/inventario').expect(401);
    role = 'TECNICO';
    await get('/reportes/ingresos').expect(403);
    await get('/reportes/ingresos/exportar?formato=xlsx').expect(403);
    expect(execute).not.toHaveBeenCalled();
  });
});
