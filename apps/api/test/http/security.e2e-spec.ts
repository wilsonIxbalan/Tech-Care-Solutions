import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { DatabaseService } from '../../src/database/database.service';
import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { SessionUser } from '../../src/modules/auth/auth.dto';
import { loginLimit } from '../../src/modules/auth/login-limiter';
import { ReportsService } from '../../src/modules/reports/reports.service';
import { MastersService } from '../../src/modules/masters/masters.service';

jest.mock('../../src/common/config', () => {
  const actual = jest.requireActual(
    '../../src/common/config',
  ) as typeof import('../../src/common/config');
  return {
    ...actual,
    envPaths: [],
    validateEnvironment: () =>
      actual.validateEnvironment({
        NODE_ENV: 'test',
        JWT_SECRET: 'test-only-secret-never-use-in-production-2026',
        FRONTEND_ORIGIN: 'http://localhost:5173',
        PORT: 3000,
      }),
  };
});

describe('Seguridad HTTP aislada', () => {
  let app: NestExpressApplication;
  let cookie: string;
  const origin = 'http://localhost:5173';
  const password = '  clave-test-sintetica  ';
  const user: SessionUser = {
    idUsuario: 1,
    nombreUsuario: 'usuario',
    nombreCompleto: 'Prueba',
    roles: ['TECNICO'],
    permisos: ['REPORTES_VER'],
  };
  let active = true;
  const repository = {
    credentials: jest.fn(),
    session: jest.fn(),
    accessed: jest.fn(),
  };
  const report = jest.fn().mockResolvedValue({ data: [], meta: {} });
  const save = jest.fn().mockResolvedValue({ idUsuario: 2 });
  const noDatabase = jest.fn(() => {
    throw new Error('SQL prohibido en HTTP tests.');
  });
  beforeAll(async () => {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    repository.credentials.mockImplementation((name: string) =>
      Promise.resolve(
        name.startsWith('limit')
          ? undefined
          : { IdUsuario: 1, PasswordHash: hash, Activo: true },
      ),
    );
    repository.session.mockImplementation(() =>
      Promise.resolve({ active, user }),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({
        pool: noDatabase,
        query: noDatabase,
        execute: noDatabase,
        transaction: noDatabase,
      })
      .overrideProvider(AuthRepository)
      .useValue(repository)
      .overrideProvider(ReportsService)
      .useValue({ report })
      .overrideProvider(MastersService)
      .useValue({
        save,
        list: jest.fn().mockResolvedValue({ data: [] }),
        one: jest.fn().mockResolvedValue({}),
      })
      .compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ nombreUsuario: 'correo@example.test', password })
      .expect(200);
    cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
    expect(login.body.data.token).toBeUndefined();
  });
  afterAll(async () => {
    await app?.close();
    expect(noDatabase).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    active = true;
    user.roles = ['TECNICO'];
    user.permisos = ['REPORTES_VER'];
    report.mockClear();
    save.mockClear();
  });

  it.each(['a'.repeat(151), 'Ana\u0000Lucía'])(
    'valida nombre completo antes de guardar y muestra detalles claros', async nombreCompleto => {
      user.roles = ['ADMINISTRADOR']; user.permisos = ['USUARIOS_GESTIONAR'];
      const result = await request(app.getHttpServer()).post('/api/v1/usuarios')
        .set('Cookie', cookie).set('Origin', origin)
        .send({ nombreUsuario: 'persona.prueba', nombreCompleto, email: 'persona@example.invalid', password: 'synthetic-only-password', roles: ['RECEPCION'] })
        .expect(400);
      expect(result.body.error.code).toBe('VALIDACION');
      expect(result.body.error.details.nombreCompleto.join(' ')).toMatch(/máximo 150|caracteres de control/);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it.each([
    { code: 'EREQUEST', number: 40613 },
    { code: 'EREQUEST', number: 40501 },
    { code: 'ECONNRESET' },
    { code: 'ELOGIN', originalError: { info: { number: 40615 } } },
  ])('indisponibilidad SQL devuelve 503 sin exponer el driver: %j', async failure => {
    report.mockRejectedValueOnce({ ...failure, message: 'PRIVATE-CANARY SQL secreto' });
    const response = await request(app.getHttpServer()).get('/api/v1/reportes/inventario')
      .set('Cookie', cookie).set('X-Request-Id', 'sql-test-request').expect(503);
    expect(response.body.error.code).toBe('SERVICIO_NO_DISPONIBLE');
    expect(response.body.requestId).toBe('sql-test-request');
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE-CANARY|ELOGIN|EREQUEST|40615/);
  });

  it.each(['facturas-saldo', 'ingresos', 'compras-proveedor'])(
    'finanzas %s exige rol confirmado además del permiso',
    async (slug) => {
      for (const role of ['TECNICO', 'RECEPCION', 'BODEGA']) {
        user.roles = [role];
        await request(app.getHttpServer())
          .get(`/api/v1/reportes/${slug}`)
          .set('Cookie', cookie)
          .expect(403);
      }
      expect(report).not.toHaveBeenCalled();
      for (const role of ['ADMINISTRADOR', 'CAJA']) {
        user.roles = [role];
        await request(app.getHttpServer())
          .get(`/api/v1/reportes/${slug}`)
          .set('Cookie', cookie)
          .expect(200);
      }
      user.permisos = [];
      await request(app.getHttpServer())
        .get(`/api/v1/reportes/${slug}`)
        .set('Cookie', cookie)
        .expect(403);
    },
  );

  it('preserva reportes operativos con REPORTES_VER', async () => {
    for (const slug of ['ordenes-activas', 'inventario'])
      await request(app.getHttpServer())
        .get(`/api/v1/reportes/${slug}`)
        .set('Cookie', cookie)
        .expect(200);
  });

  it('no añade registro público ni permite administrar usuarios sin ADMINISTRADOR', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send({})
      .expect(404);
    for (const role of ['TECNICO', 'RECEPCION', 'BODEGA', 'CAJA']) {
      user.roles = [role];
      await request(app.getHttpServer())
        .get('/api/v1/usuarios')
        .set('Cookie', cookie)
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .set('Cookie', cookie)
        .set('Origin', origin)
        .send({})
        .expect(403);
      await request(app.getHttpServer())
        .patch('/api/v1/usuarios/2')
        .set('Cookie', cookie)
        .set('Origin', origin)
        .send({ activo: false })
        .expect(403);
    }
    expect(save).not.toHaveBeenCalled();
    user.roles = ['ADMINISTRADOR'];
    await request(app.getHttpServer())
      .patch('/api/v1/usuarios/2')
      .set('Cookie', cookie)
      .set('Origin', origin)
      .send({ activo: false })
      .expect(200);
    expect(save).toHaveBeenCalledWith(
      'usuarios',
      expect.objectContaining({ activo: false }),
      2,
      1,
    );
  });

  it('vuelve a consultar estado/roles por petición y rechaza usuario desactivado', async () => {
    active = false;
    const result = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(403);
    expect(result.body.error.code).toBe('USUARIO_INACTIVO');
  });

  it('rechaza JWT expirado o con audiencia equivocada', async () => {
    const secret = app.get(ConfigService).getOrThrow<string>('JWT_SECRET');
    for (const options of [
      { expiresIn: -1, audience: 'techcare-web' },
      { expiresIn: 3600, audience: 'otra-app' },
    ]) {
      const token = await app
        .get(JwtService)
        .signAsync(
          {},
          { secret, subject: '1', issuer: 'techcare-api', ...options },
        );
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', `techcare_session=${token}`)
        .expect(401);
    }
  });

  it('cookie de producción es host-only Secure HttpOnly; logout borra con mismos atributos', async () => {
    const config = app.get(ConfigService);
    config.set('NODE_ENV', 'production');
    try {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send({ nombreUsuario: 'correo@example.test', password })
        .expect(200);
      const value = (login.headers['set-cookie'] as unknown as string[])[0];
      for (const attribute of [
        '__Host-techcare_session=',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Path=/',
        'Max-Age=3600',
      ])
        expect(value).toContain(attribute);
      expect(value).not.toContain('Domain=');
      const logout = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Origin', origin)
        .send({})
        .expect(200);
      const cleared = (logout.headers['set-cookie'] as unknown as string[])[0];
      for (const attribute of [
        '__Host-techcare_session=;',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Path=/',
        'Expires=Thu, 01 Jan 1970',
      ])
        expect(cleared).toContain(attribute);
    } finally {
      config.set('NODE_ENV', 'test');
    }
  });

  it('responde 429 antes de consultar credenciales; otras identidades no se bloquean por IP/proxy', async () => {
    expect(app.getHttpAdapter().getInstance().get('trust proxy')).toBe(false);
    for (let i = 0; i < loginLimit.attempts; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send({ nombreUsuario: 'limit@example.test', password: 'incorrecta' })
        .expect(401);
    const count = repository.credentials.mock.calls.length;
    const limited = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ nombreUsuario: 'LIMIT@example.test', password: 'incorrecta' })
      .expect(429);
    expect(limited.body.error.code).toBe('LOGIN_LIMITADO');
    expect(repository.credentials.mock.calls).toHaveLength(count);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ nombreUsuario: 'otra@example.test', password })
      .expect(200);
  }, 30000);
});
