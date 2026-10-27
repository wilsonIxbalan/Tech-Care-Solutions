import * as sql from 'mssql';
import { DatabaseService, Param, Row } from '../../src/database/database.service';
import { MastersRepository } from '../../src/modules/masters/masters.repository';

// Modelo aislado: respeta el mutex de rol solicitado por el repositorio.
// No sustituye una prueba de integración del motor SQL Server.
function fixture(adminIds = [1], legacy = false) {
  const users = new Map([1, 2, 3].map((id) => [id, {
    IdUsuario: id, NombreUsuario: legacy ? `legacy${id}@example.test` : `user${id}`,
    NombreCompleto: 'Prueba', Email: `correo${id}@example.test`, Activo: id !== 3,
  }]));
  const roles = new Map([1, 2, 3].map((id) => [id, adminIds.includes(id) ? ['ADMINISTRADOR'] : ['TECNICO']]));
  let tail = Promise.resolve();
  const releases = new Map<sql.Transaction, () => void>();
  const calls: { statement: string; tx: sql.Transaction; params: Param[] }[] = [];
  const query = jest.fn(async (statement: string, params: Param[] = [], tx: sql.Transaction) => {
    calls.push({ statement, tx, params });
    const value = (name: string) => params.find((p) => p.name === name)?.value;
    let recordset: Row[] = [];
    if (statement.includes('WITH (UPDLOCK,HOLDLOCK)')) {
      const previous = tail;
      tail = new Promise<void>((resolve) => { releases.set(tx, resolve); });
      await previous;
      recordset = [{ IdRol: 1 }];
    } else if (statement.startsWith('SELECT u.IdUsuario')) {
      recordset = [...users.values()].filter((u) => u.Activo && roles.get(u.IdUsuario)?.includes('ADMINISTRADOR')).map((u) => ({ IdUsuario: u.IdUsuario }));
    } else if (statement.startsWith('SELECT IdUsuario,NombreUsuario')) {
      const row = users.get(Number(value('Id')));
      recordset = row ? [{ ...row }] : [];
    } else if (statement.startsWith('SELECT r.Codigo')) {
      recordset = (roles.get(Number(value('Id'))) ?? []).map((Codigo) => ({ Codigo }));
    } else if (statement.startsWith('UPDATE dbo.Usuario')) {
      const user = users.get(Number(value('Id')))!;
      Object.assign(user, Object.fromEntries(params.filter((p) => p.name !== 'Id').map((p) => [p.name, p.value])));
    } else if (statement.startsWith('SELECT IdRol FROM dbo.Rol WHERE Activo')) {
      recordset = params.filter((p) => ['ADMINISTRADOR', 'TECNICO'].includes(String(p.value)))
        .map((p) => ({ IdRol: p.value === 'ADMINISTRADOR' ? 1 : 2 }));
    } else if (statement.startsWith('DELETE dbo.UsuarioRol')) {
      roles.set(Number(value('Id')), []);
    } else if (statement.startsWith('INSERT dbo.UsuarioRol')) {
      roles.get(Number(value('IdUsuario')))!.push(value('IdRol') === 1 ? 'ADMINISTRADOR' : 'TECNICO');
    } else {
      throw new Error('SQL no previsto en fixture aislado.');
    }
    return { recordset };
  });
  const transactions: sql.Transaction[] = [];
  const transaction = async <T>(work: (tx: sql.Transaction) => Promise<T>) => {
    const tx = {} as sql.Transaction;
    transactions.push(tx);
    try { return await work(tx); }
    finally { releases.get(tx)?.(); }
  };
  return { repository: new MastersRepository({ query, transaction } as unknown as DatabaseService), calls, users, roles, transactions };
}

describe('Último administrador activo', () => {
  it.each([{ activo: false }, { roles: ['TECNICO'] }, { activo: false, roles: ['TECNICO'] }])('rechaza perder al único administrador: %j', async (body) => {
    const f = fixture();
    await expect(f.repository.save('usuarios', body, 1)).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'ULTIMO_ADMINISTRADOR' }) });
    expect(f.calls[0].statement).toContain('WITH (UPDLOCK,HOLDLOCK)');
    expect(f.calls.every((call) => call.tx === f.transactions[0])).toBe(true);
    expect(f.calls.some((call) => /^(UPDATE|INSERT|DELETE)/.test(call.statement))).toBe(false);
  });

  it('permite editar el resto de datos y conservar username legacy con @', async () => {
    const f = fixture([1], true);
    await expect(f.repository.save('usuarios', { nombreCompleto: 'Otro', nombreUsuario: 'legacy1@example.test', activo: true, roles: ['ADMINISTRADOR'] }, 1)).resolves.toHaveProperty('nombreCompleto', 'Otro');
    expect(f.roles.get(1)).toEqual(['ADMINISTRADOR']);
  });

  it.each(['nuevo@example.test', 'con espacio', 'control\u0000'])('rechaza username nuevo o cambio a %j', async (name) => {
    const f = fixture([1], true);
    await expect(f.repository.save('usuarios', { nombreUsuario: name }, 1)).rejects.toMatchObject({ status: 400 });
    await expect(f.repository.save('usuarios', { nombreUsuario: name })).rejects.toMatchObject({ status: 400 });
  });

  it('permite cambiar username legacy a uno sin @', async () => {
    const f = fixture([1], true);
    await expect(f.repository.save('usuarios', { nombreUsuario: 'nuevo_usuario' }, 1)).resolves.toHaveProperty('nombreUsuario', 'nuevo_usuario');
  });

  it('permite retirar a un admin si hay otro activo, no cuenta admins inactivos', async () => {
    const f = fixture([1, 2, 3]);
    await f.repository.save('usuarios', { roles: ['TECNICO'] }, 1);
    await expect(f.repository.save('usuarios', { activo: false }, 2)).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    [{ activo: false }, { activo: false }],
    [{ roles: ['TECNICO'] }, { roles: ['TECNICO'] }],
    [{ activo: false }, { roles: ['TECNICO'] }],
  ])('serializa dos retiros concurrentes antes de leer usuarios (%j / %j)', async (first, second) => {
    const f = fixture([1, 2]);
    const results = await Promise.allSettled([
      f.repository.save('usuarios', first, 1), f.repository.save('usuarios', second, 2),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(results[1]).toMatchObject({ reason: { status: 409 } });
    for (const tx of f.transactions) {
      const calls = f.calls.filter((call) => call.tx === tx);
      expect(calls[0].statement).toContain('WITH (UPDLOCK,HOLDLOCK)');
      expect(calls[1].statement).toContain('u.Activo=1 AND r.Activo=1');
    }
    expect([...f.users.values()].filter((u) => u.Activo && f.roles.get(u.IdUsuario)?.includes('ADMINISTRADOR'))).toHaveLength(1);
  });
});
