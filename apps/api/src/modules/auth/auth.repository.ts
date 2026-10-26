import { Injectable } from '@nestjs/common';
import { DatabaseService, int, text } from '../../database/database.service';
import { SessionUser } from './auth.dto';
@Injectable()
export class AuthRepository {
  constructor(private readonly db: DatabaseService) {}
  async credentials(nombreUsuario: string) {
    const result = await this.db.query(
      'SELECT IdUsuario,PasswordHash,Activo FROM dbo.Usuario WHERE NombreUsuario=@NombreUsuario;',
      [text('NombreUsuario', 50, nombreUsuario)],
    );
    return result.recordset[0];
  }
  async session(
    id: number,
  ): Promise<{ active: boolean; user: SessionUser } | null> {
    const result = await this.db.query(
      `SELECT IdUsuario,NombreUsuario,NombreCompleto,Activo FROM dbo.Usuario WHERE IdUsuario=@Id;
      SELECT r.Codigo FROM dbo.UsuarioRol ur JOIN dbo.Rol r ON r.IdRol=ur.IdRol WHERE ur.IdUsuario=@Id AND r.Activo=1 ORDER BY r.Codigo;
      SELECT DISTINCT p.Codigo FROM dbo.UsuarioRol ur JOIN dbo.Rol r ON r.IdRol=ur.IdRol AND r.Activo=1 JOIN dbo.RolPermiso rp ON rp.IdRol=r.IdRol JOIN dbo.Permiso p ON p.IdPermiso=rp.IdPermiso WHERE ur.IdUsuario=@Id ORDER BY p.Codigo;`,
      [int('Id', id)],
    );
    const sets =
      result.recordsets as import('../../database/database.service').Row[][];
    const row = sets[0][0];
    if (!row) return null;
    return {
      active: Boolean(row.Activo),
      user: {
        idUsuario: Number(row.IdUsuario),
        nombreUsuario: String(row.NombreUsuario),
        nombreCompleto: String(row.NombreCompleto),
        roles: sets[1].map((r) => String(r.Codigo)),
        permisos: sets[2].map((r) => String(r.Codigo)),
      },
    };
  }
  async accessed(id: number) {
    await this.db.query(
      'UPDATE dbo.Usuario SET UltimoAcceso=SYSUTCDATETIME(),IntentosFallidos=0 WHERE IdUsuario=@Id;',
      [int('Id', id)],
    );
  }
}
