import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ApiError, invalid, notFound } from '../../../src/common/api-error';
import { configureApp } from '../../../src/configure-app';
import { ReadRepository } from '../../../src/database/read.repository';
import { AccessGuard } from '../../../src/modules/auth/access';
import { SessionUser } from '../../../src/modules/auth/auth.dto';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { DownloadsController, FinancialExportGuard } from '../../../src/modules/downloads/downloads.controller';
import { DownloadsService } from '../../../src/modules/downloads/downloads.service';
import { reports, ReportsRepository } from '../../../src/modules/reports/reports.repository';

describe('Downloads HTTP (repositorios mock; ninguna conexión BD)', () => {
  let app: NestExpressApplication;
  let user: SessionUser;
  const execute = jest.fn();
  const invoiceDetail = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DownloadsController],
      providers: [
        DownloadsService, FinancialExportGuard,
        { provide: APP_GUARD, useClass: AccessGuard },
        { provide: ConfigService, useValue: new ConfigService({ NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173' }) },
        { provide: ReportsRepository, useValue: { execute } },
        { provide: ReadRepository, useValue: { invoiceDetail } },
        { provide: AuthService, useValue: { authenticate: jest.fn((token?: string) => {
          if (token !== 'valid') throw new ApiError(401, 'SESION_INVALIDA', 'Sesión requerida.');
          return Promise.resolve(user);
        }) } },
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    user = { idUsuario: 1, nombreUsuario: 'sintetico', nombreCompleto: 'Sintético', roles: ['CAJA'], permisos: ['REPORTES_VER'] };
    execute.mockImplementation((slug: string, filters: Record<string, unknown>) => {
      if (!Object.prototype.hasOwnProperty.call(reports, slug)) throw notFound();
      if (filters.estado === 'NO_VALIDO') throw invalid('estado', 'Estado no permitido.');
      return Promise.resolve([[{ IdFactura: 1, Total: 12.3 }], [{ IdPago: 4, IdFactura: 1, Monto: 0 }]]);
    });
    invoiceDetail.mockResolvedValue({ numeroFactura: 'F-001', numeroOrden: 'OT-001', total: '12.30', detalles: [], pagos: [] });
  });
  const get = (path: string) => request(app.getHttpServer()).get(`/api/v1${path}`).set('Cookie', 'techcare_session=valid');
  const binary = (call: request.Test) => call.buffer(true).parse((response, done) => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    response.on('end', () => done(null, Buffer.concat(chunks)));
    response.on('error', (error: Error) => done(error, undefined));
  });

  it('autenticación antes de cualquier lectura', async () => {
    await request(app.getHttpServer()).get('/api/v1/reportes/inventario/exportar?formato=csv&conjunto=1').expect(401);
    await request(app.getHttpServer()).get('/api/v1/facturas/1/pdf').expect(401);
    expect(execute).not.toHaveBeenCalled();
    expect(invoiceDetail).not.toHaveBeenCalled();
  });

  it('CSV real sin envelope, Content-Disposition seguro y private no-store', async () => {
    const result = await get('/reportes/inventario/exportar?formato=csv&conjunto=1&page=2&pageSize=1&idBodega=3').expect(200);
    expect(result.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(result.headers['content-disposition']).toBe('attachment; filename="inventario-conjunto-1.csv"');
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(result.text).toBe('\uFEFF"idFactura","total"\r\n"1","12.30"\r\n');
    expect(execute).toHaveBeenCalledWith('inventario', { page: 2, pageSize: 1, idBodega: 3 });
  });

  it.each([
    'formato=exe', 'formato=CSV&conjunto=1', 'formato=csv&conjunto=0', 'formato=csv&conjunto=1.5',
    'formato=csv&conjunto=1&adicional=si', 'formato=csv&conjunto=1&idBodega=no',
    'formato=csv&conjunto=1&pageSize=101', 'formato=csv&conjunto=1&formato=xlsx',
  ])('DTO de exportación valida y rechaza %s sin leer', async (query) => {
    await get(`/reportes/inventario/exportar?${query}`).expect(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('CSV exige conjunto y XLSX rechaza selección parcial', async () => {
    await get('/reportes/inventario/exportar?formato=csv').expect(400);
    await get('/reportes/inventario/exportar?formato=xlsx&conjunto=1').expect(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('XLSX y PDF entregan binarios sin envoltura JSON', async () => {
    const xlsx = await binary(get('/reportes/ingresos/exportar?formato=xlsx')).expect(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml.sheet');
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    const pdf = await binary(get('/facturas/7/pdf')).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toBe('attachment; filename="factura-simulada-7.pdf"');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(invoiceDetail).toHaveBeenCalledWith(7);
  });

  it.each(['facturas-saldo', 'ingresos', 'compras-proveedor'])('bloquea %s para REPORTES_VER sin rol financiero antes de leer', async (slug) => {
    user.roles = ['TECNICO'];
    await get(`/reportes/${slug}/exportar?formato=csv&conjunto=1`).expect(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it('otros reportes operativos mantienen REPORTES_VER', async () => {
    user.roles = ['TECNICO'];
    await get('/reportes/inventario/exportar?formato=csv&conjunto=1').expect(200);
    user.permisos = [];
    await get('/reportes/inventario/exportar?formato=csv&conjunto=1').expect(403);
  });

  it.each(['FACTURAR', 'PAGOS_REGISTRAR', 'REPORTES_VER'])('PDF admite rol financiero + %s', async (permission) => {
    user.permisos = [permission];
    await get('/facturas/1/pdf').expect(200);
  });

  it('PDF deniega rol o permiso insuficiente antes de consultar', async () => {
    user.roles = ['RECEPCION'];
    user.permisos = ['FACTURAR'];
    await get('/facturas/1/pdf').expect(403);
    user.roles = ['CAJA'];
    user.permisos = ['ENTREGAR_ORDEN'];
    await get('/facturas/1/pdf').expect(403);
    expect(invoiceDetail).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '2147483648'])('PDF valida id %s antes de leer', async (id) => {
    await get(`/facturas/${id}/pdf`).expect(400);
    expect(invoiceDetail).not.toHaveBeenCalled();
  });

  it('preserva errores 404, validación de filtros y límite 413 como JSON', async () => {
    await get('/reportes/no-existe/exportar?formato=csv&conjunto=1').expect(404);
    await get('/reportes/inventario/exportar?formato=csv&conjunto=1&estado=NO_VALIDO').expect(400);
    execute.mockResolvedValueOnce([Array.from({ length: 10001 }, () => ({ Id: 1 }))]);
    const response = await get('/reportes/inventario/exportar?formato=csv&conjunto=1').expect(413);
    expect(response.body.error.code).toBe('EXPORTACION_DEMASIADO_GRANDE');
    invoiceDetail.mockRejectedValueOnce(notFound());
    await get('/facturas/99/pdf').expect(404);
  });
});
