import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { DatabaseService } from './../src/database/database.service';
import { AuthRepository } from './../src/modules/auth/auth.repository';

// No leer archivos privados ni depender de secretos/configuracion del equipo.
jest.mock('../src/common/config', () => {
  const actual = jest.requireActual('../src/common/config') as typeof import('../src/common/config');
  return {
    ...actual,
    envPaths: [],
    validateEnvironment: () => actual.validateEnvironment({
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-secret-never-use-in-production-2026',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      PORT: 3000,
    }),
  };
});

describe('API HTTP y sesion (sin conexion SQL)', () => {
  let app: NestExpressApplication;
  const origin = 'http://localhost:5173';
  const password = 'test-only-password-2026';
  const user = {
    idUsuario: 1,
    nombreUsuario: 'usuario_prueba',
    nombreCompleto: 'Usuario sintetico',
    roles: ['RECEPCION'],
    permisos: ['CLIENTES_GESTIONAR'],
  };
  const repository = {
    credentials: jest.fn(),
    session: jest.fn(),
    accessed: jest.fn().mockResolvedValue(undefined),
  };
  const noDatabase = () => {
    throw new Error('Las pruebas HTTP no pueden acceder a SQL.');
  };
  const database = {
    pool: jest.fn(noDatabase),
    query: jest.fn(noDatabase),
    execute: jest.fn(noDatabase),
    transaction: jest.fn(noDatabase),
  };

  beforeAll(async () => {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    repository.credentials.mockImplementation((name: string) =>
      Promise.resolve(name === user.nombreUsuario
        ? { IdUsuario: 1, PasswordHash: hash, Activo: true }
        : undefined),
    );
    repository.session.mockResolvedValue({ active: true, user });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService).useValue(database)
      .overrideProvider(AuthRepository).useValue(repository)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    for (const method of Object.values(database)) expect(method).not.toHaveBeenCalled();
  });

  it('GET /api/v1/health responde sin consultar SQL', async () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect('Cache-Control', 'private, no-store')
      .expect({ data: { status: 'ok' } });
  });

  it('GET /api/v1/auth/me exige sesion', async () => {
    const result = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    expect(result.body.error.code).toBe('SESION_INVALIDA');
    expect(result.body.requestId).toEqual(expect.any(String));
  });

  it.each([undefined, 'null', 'https://otro.example'])('rechaza escrituras con Origin %s', async (value) => {
    const call = request(app.getHttpServer()).post('/api/v1/auth/login');
    if (value !== undefined) call.set('Origin', value);
    const result = await call.send({ nombreUsuario: user.nombreUsuario, password }).expect(403);
    expect(result.body.error.code).toBe('ORIGEN_NO_PERMITIDO');
  });

  it('valida el DTO y rechaza campos adicionales', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/login').set('Origin', origin)
      .send({ nombreUsuario: user.nombreUsuario, password, rol: 'ADMINISTRADOR' }).expect(400);
    expect(result.body.error.code).toBe('VALIDACION');
    expect(result.body.error.details.rol).toEqual(expect.any(Array));
  });

  it('rechaza credenciales incorrectas', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/login').set('Origin', origin)
      .send({ nombreUsuario: user.nombreUsuario, password: 'incorrecta' }).expect(401);
    expect(result.body.error.code).toBe('CREDENCIALES_INVALIDAS');
  });

  it('login -> me -> rechazo por permiso -> logout -> me=401', async () => {
    const client = request.agent(app.getHttpServer());
    const login = await client.post('/api/v1/auth/login').set('Origin', origin)
      .send({ nombreUsuario: user.nombreUsuario, password }).expect(200);
    expect(login.body).toEqual({ data: { usuario: user, expiresIn: 3600 } });
    const cookies = login.headers['set-cookie'] as unknown as string[];
    expect(cookies[0]).toContain('techcare_session=');
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Lax');
    expect(cookies[0]).not.toContain('Domain=');
    await client.get('/api/v1/auth/me').expect(200).expect({ data: user });
    const denied = await client.get('/api/v1/dashboard').expect(403);
    expect(denied.body.error.code).toBe('PERMISO_DENEGADO');
    await client.post('/api/v1/auth/logout').set('Origin', origin).send({}).expect(200);
    await client.get('/api/v1/auth/me').expect(401);
  });

  it('rechaza una cookie con firma invalida', async () => {
    const result = await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Cookie', 'techcare_session=token-invalido').expect(401);
    expect(result.body.error.code).toBe('SESION_INVALIDA');
  });
});
