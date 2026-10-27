import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DatabaseService, Row } from '../../src/database/database.service';
import { LoginDto } from '../../src/modules/auth/auth.dto';
import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { AuthService } from '../../src/modules/auth/auth.service';
import { LoginLimiter } from '../../src/modules/auth/login-limiter';
import { UserInput, UserPatch } from '../../src/modules/masters/masters.dto';
import { MastersRepository } from '../../src/modules/masters/masters.repository';
import { MastersService } from '../../src/modules/masters/masters.service';

describe('Identidad y DTO de autenticación', () => {
  const password = '  clave-sintetica-2026  ';
  let hash: string;
  beforeAll(async () => { hash = await argon2.hash(password, { type: argon2.argon2id }); });

  it.each([{ rows: [] }, { rows: [{ IdUsuario: 1 }, { IdUsuario: 2 }] }])('rechaza ausencia o ambigüedad (%j)', async ({ rows }) => {
    const query = jest.fn().mockResolvedValue({ recordset: rows });
    const repository = new AuthRepository({ query } as unknown as DatabaseService);
    await expect(repository.credentials('legacy@example.test')).resolves.toBeUndefined();
  });

  it.each(['nombre_usuario', 'correo@example.test', "' OR 1=1--"])('consulta username y correo con un parámetro de 120 (%s)', async (identity) => {
    const row = { IdUsuario: 1, Activo: true, PasswordHash: 'hash-no-expuesto' };
    const query = jest.fn().mockResolvedValue({ recordset: [row] });
    const repository = new AuthRepository({ query } as unknown as DatabaseService);
    await expect(repository.credentials(identity)).resolves.toEqual(row);
    const [statement, params] = query.mock.calls[0] as [string, { name: string; value: string; type: { length: number } }[]];
    expect(statement).toContain('NombreUsuario=@Identificador OR Email=@Identificador');
    expect(statement).not.toContain(identity);
    expect(params).toEqual([expect.objectContaining({ name: 'Identificador', value: identity })]);
    expect(params[0].type.length).toBe(120);
  });

  it('recorta solo identificador y admite correo de hasta 120 caracteres', async () => {
    const identity = `${'a'.repeat(64)}@${'b'.repeat(50)}.test`;
    expect(identity).toHaveLength(120);
    const dto = plainToInstance(LoginDto, { nombreUsuario: ` ${identity} `, password });
    expect(await validate(dto)).toEqual([]);
    expect(dto.nombreUsuario).toBe(identity);
    expect(dto.password).toBe(password);
    expect(await validate(plainToInstance(LoginDto, { nombreUsuario: `${identity}x`, password }))).not.toEqual([]);
  });

  it.each([null, '', 12])('rechaza contraseña inválida sin convertirla (%j)', async (value) => {
    const dto = plainToInstance(LoginDto, { nombreUsuario: 'usuario', password: value });
    expect((await validate(dto)).some((error) => error.property === 'password')).toBe(true);
  });

  it('valida correo, longitudes, roles y nulls en usuario y patch', async () => {
    const valid = { nombreUsuario: 'admin', nombreCompleto: 'Persona Prueba', email: 'persona@example.test', password, roles: ['ADMINISTRADOR'] };
    expect(await validate(plainToInstance(UserInput, valid))).toEqual([]);
    for (const fields of [{ email: 'no-es-correo' }, { email: null }, { nombreUsuario: 'x'.repeat(51) }, { roles: [] }, { roles: ['ADMINISTRADOR', 'ADMINISTRADOR'] }, { roles: ['OTRO'] }, { password: 'corta' }])
      expect(await validate(plainToInstance(UserInput, { ...valid, ...fields }))).not.toEqual([]);
    expect(await validate(plainToInstance(UserPatch, { nombreCompleto: ' Otro nombre ' }))).toEqual([]);
    expect(await validate(plainToInstance(UserPatch, { email: null }))).not.toEqual([]);
  });

  function service(rows: Row[]) {
    const query = jest.fn().mockResolvedValue({ recordset: rows });
    const repository = new AuthRepository({ query } as unknown as DatabaseService);
    jest.spyOn(repository, 'session').mockResolvedValue({ active: true, user: {
      idUsuario: 1, nombreUsuario: 'usuario', nombreCompleto: 'Prueba', roles: ['CAJA'], permisos: [],
    } });
    jest.spyOn(repository, 'accessed').mockResolvedValue(undefined);
    const jwt = { signAsync: jest.fn().mockResolvedValue('jwt-sintetico') };
    const auth = new AuthService(repository, jwt as unknown as JwtService,
      new ConfigService({ JWT_SECRET: 'test-secret' }), new LoginLimiter());
    return { auth, repository, jwt };
  }

  it.each(['usuario', 'persona@example.test'])('autentica por identidad y conserva espacios en password (%s)', async (identity) => {
    const { auth } = service([{ IdUsuario: 1, PasswordHash: hash, Activo: true }]);
    await expect(auth.login({ nombreUsuario: identity, password })).resolves.toHaveProperty('token');
    await expect(auth.login({ nombreUsuario: identity, password: password.trim() })).rejects.toMatchObject({ status: 401 });
  });

  it.each([{ rows: [] }, { rows: [{ IdUsuario: 1, PasswordHash: 'legacy-no-argon', Activo: true }] },
    { rows: [{ IdUsuario: 1, PasswordHash: '$argon2id$invalido', Activo: true }] },
    { rows: [{ IdUsuario: 1, Activo: true }, { IdUsuario: 2, Activo: false }] }])('credenciales inválidas no firman tokens (%j)', async ({ rows }) => {
    const { auth, repository, jwt } = service(rows);
    await expect(auth.login({ nombreUsuario: 'legacy@example.test', password })).rejects.toMatchObject({ status: 401, response: expect.objectContaining({ code: 'CREDENCIALES_INVALIDAS' }) });
    expect(repository.session).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rechaza cuenta inactiva y desactivación entre lectura de credenciales y sesión', async () => {
    const inactive = service([{ IdUsuario: 1, PasswordHash: hash, Activo: false }]);
    await expect(inactive.auth.login({ nombreUsuario: 'usuario', password })).rejects.toMatchObject({ status: 401 });
    const changed = service([{ IdUsuario: 1, PasswordHash: hash, Activo: true }]);
    jest.spyOn(changed.repository, 'session').mockResolvedValue({ active: false, user: { idUsuario: 1, nombreUsuario: 'usuario', nombreCompleto: 'Prueba', roles: [], permisos: [] } });
    await expect(changed.auth.login({ nombreUsuario: 'usuario', password })).rejects.toMatchObject({ status: 401 });
    expect(changed.jwt.signAsync).not.toHaveBeenCalled();
  });

  it('administración hashea la contraseña exacta y no la pasa al repositorio', async () => {
    const save = jest.fn().mockResolvedValue({ idUsuario: 1 });
    const masters = new MastersService({ save } as unknown as MastersRepository);
    const input = { password };
    await masters.save('usuarios', input);
    const saved = save.mock.calls[0][1] as { password?: string; passwordHash: string };
    expect(saved.password).toBeUndefined();
    expect(saved.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(saved.passwordHash, password)).toBe(true);
    expect(input.password).toBe(password);
  });
});
