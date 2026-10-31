import { createRequire } from 'node:module';

// Carga real de dependencias, pero nunca connect()/getToken() ni llamadas HTTP.
const nativeRequire = createRequire(__filename);

describe('Compatibilidad de overrides de seguridad', () => {
  it('ExcelJS mantiene uuid CommonJS/v4 y v5 rechaza buffers pequenos', () => {
    const excelRequire = createRequire(nativeRequire.resolve('exceljs'));
    const uuid = excelRequire('uuid') as {
      v4(): string;
      v5(value: string, ns: string, buffer: Uint8Array, offset: number): unknown;
    };
    expect(uuid.v4()).toMatch(/^[0-9a-f-]{36}$/);
    expect(() => uuid.v5('sample', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', new Uint8Array(8), 4)).toThrow(RangeError);
  });
  it('SQL driver, Azure Identity y MSAL parcheado se cargan sin conexion', () => {
    const mssql = nativeRequire('mssql') as typeof import('mssql');
    const driverRequire = createRequire(nativeRequire.resolve('mssql'));
    const tediousRequire = createRequire(driverRequire.resolve('tedious'));
    const identityEntry = tediousRequire.resolve('@azure/identity');
    const identityRequire = createRequire(identityEntry);
    const identity = tediousRequire('@azure/identity') as Record<string, unknown>;
    const msal = identityRequire('@azure/msal-node') as { PublicClientApplication: unknown; version: string };
    expect(typeof identity.ClientSecretCredential).toBe('function');
    expect(typeof msal.PublicClientApplication).toBe('function');
    expect(msal.version).toBe('7.1.0');
    const pool = new mssql.ConnectionPool({ server: 'example.invalid', database: 'TestOnly', user: 'test', password: 'test-only', options: { encrypt: true } });
    expect(pool.connected).toBe(false);
  });
});
