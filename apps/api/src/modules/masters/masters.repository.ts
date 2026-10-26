import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { ApiError, invalid, notFound } from '../../common/api-error';
import { MasterQuery } from '../../common/query.dto';
import {
  DatabaseService,
  int,
  money,
  param,
  Param,
  Row,
  text,
} from '../../database/database.service';
import { pagination, publicRow, publicRows } from '../../database/rows';
import { catalogs, FieldMap, MasterName, masters } from './masters.config';
@Injectable()
export class MastersRepository {
  constructor(private readonly db: DatabaseService) {}
  private parameters(body: Record<string, unknown>, fields: FieldMap) {
    return Object.entries(body)
      .filter(([key]) => key in fields)
      .map(([key, value]) => {
        const [column, length] = fields[key];
        return length === 0
          ? int(column, value)
          : length === -1
            ? money(column, value)
            : length === -2
              ? param(column, sql.Bit, value)
              : text(column, length, value);
      });
  }
  private source(name: MasterName) {
    if (name === 'equipos')
      return {
        from: 'dbo.Equipo e JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente JOIN dbo.TipoEquipo t ON t.IdTipoEquipo=e.IdTipoEquipo JOIN dbo.Marca m ON m.IdMarca=e.IdMarca',
        columns:
          'e.IdEquipo,e.IdCliente,c.NombreMostrar AS ClienteNombre,e.IdTipoEquipo,t.Nombre AS TipoEquipoNombre,e.IdMarca,m.Nombre AS MarcaNombre,e.Modelo,e.NumeroSerie,e.Descripcion,e.Estado,e.FechaRegistro',
        alias: 'e.',
      };
    return {
      from: `dbo.${masters[name].table}`,
      columns: masters[name].columns,
      alias: '',
    };
  }
  async one(name: MasterName, id: number, tx?: sql.Transaction) {
    const source = this.source(name);
    const result = await this.db.query(
      `SELECT ${source.columns} FROM ${source.from} WHERE ${source.alias}${masters[name].id}=@Id;`,
      [int('Id', id)],
      tx,
    );
    if (!result.recordset[0]) throw notFound();
    const row = publicRow(result.recordset[0]);
    if (name === 'usuarios')
      row.roles = (
        await this.db.query(
          'SELECT r.Codigo FROM dbo.UsuarioRol ur JOIN dbo.Rol r ON r.IdRol=ur.IdRol WHERE ur.IdUsuario=@Id ORDER BY r.Codigo;',
          [int('Id', id)],
          tx,
        )
      ).recordset.map((r) => r.Codigo);
    return row;
  }
  async list(name: MasterName, query: MasterQuery) {
    const config = masters[name];
    const source = this.source(name);
    const where: string[] = [];
    const params: Param[] = [];
    if (query.search) {
      where.push(
        `(${config.search.map((column) => `${source.alias}${column} LIKE @Search ESCAPE '~'`).join(' OR ')})`,
      );
      params.push(
        text('Search', 310, `%${query.search.replace(/[~%_\[]/g, '~$&')}%`),
      );
    }
    for (const key of [
      'estado',
      'idCliente',
      'idCategoria',
      'activo',
    ] as const) {
      const fields: FieldMap = config.fields;
      if (query[key] !== undefined && fields[key]) {
        const [column, type] = fields[key];
        where.push(`${source.alias}${column}=@${column}`);
        params.push(
          type === 0
            ? int(column, query[key])
            : type === -2
              ? param(column, sql.Bit, query[key])
              : text(column, type, query[key]),
        );
      }
    }
    const predicate = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT COUNT(*) AS Total FROM ${source.from} ${predicate}; SELECT ${source.columns} FROM ${source.from} ${predicate} ORDER BY ${source.alias}${config.id} DESC OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;`,
      [
        ...params,
        param('Offset', sql.BigInt, (query.page - 1) * query.pageSize),
        int('Limit', query.pageSize),
      ],
    );
    const sets = result.recordsets as Row[][];
    const rows = publicRows(sets[1]);
    if (name === 'usuarios') {
      for (const row of rows)
        row.roles = (await this.one('usuarios', Number(row.idUsuario))).roles;
    }
    return {
      data: rows,
      meta: pagination(query.page, query.pageSize, Number(sets[0][0].Total)),
    };
  }
  async save(
    name: MasterName,
    body: Record<string, unknown>,
    id?: number,
    actor?: number,
  ) {
    return this.db.transaction(async (tx) => {
      const config = masters[name];
      const current = id ? await this.one(name, id, tx) : undefined;
      const merged = { ...current, ...body };
      if (name === 'clientes') {
        if (
          merged.tipoCliente === 'INDIVIDUAL' &&
          (!merged.nombres || !merged.apellidos)
        )
          throw invalid(
            'nombres',
            'El cliente individual requiere nombres y apellidos.',
          );
        if (merged.tipoCliente === 'EMPRESARIAL' && !merged.razonSocial)
          throw invalid('razonSocial', 'La empresa requiere razón social.');
      }
      if (
        name === 'equipos' &&
        current &&
        body.idCliente !== undefined &&
        body.idCliente !== current.idCliente
      ) {
        const history = await this.db.query(
          'SELECT TOP (1) IdOrden FROM dbo.vw_Ordenes WHERE IdEquipo=@Id;',
          [int('Id', id)],
          tx,
        );
        if (history.recordset.length)
          throw new ApiError(
            409,
            'EQUIPO_CON_HISTORIAL',
            'No se puede transferir un equipo con órdenes históricas.',
          );
      }
      if (
        name === 'repuestos' &&
        id &&
        body.codigo !== undefined &&
        body.codigo !== current?.codigo
      )
        throw invalid(
          'codigo',
          'El código del repuesto no se puede modificar con los permisos SQL actuales.',
        );
      let params = this.parameters(body, config.fields);
      if (id) {
        if (name === 'repuestos')
          params = params.filter(
            (p) =>
              !['Codigo', 'PrecioCompraReferencia', 'PrecioVenta'].includes(
                p.name,
              ),
          );
        if (params.length)
          await this.db.query(
            `UPDATE dbo.${config.table} SET ${params.map((p) => `${p.name}=@${p.name}`).join(',')} WHERE ${config.id}=@Id;`,
            [...params, int('Id', id)],
            tx,
          );
        if (
          name === 'repuestos' &&
          (body.precioCompraReferencia !== undefined ||
            body.precioVenta !== undefined)
        )
          await this.db.execute(
            'dbo.usp_ActualizarPreciosRepuesto',
            [
              int('IdRepuesto', id),
              money('PrecioCompraReferencia', merged.precioCompraReferencia),
              money('PrecioVenta', merged.precioVenta),
              int('IdUsuario', actor),
            ],
            [],
            tx,
          );
      } else {
        const result = await this.db.query(
          `INSERT dbo.${config.table} (${params.map((p) => p.name).join(',')}) VALUES (${params.map((p) => `@${p.name}`).join(',')}); SELECT CONVERT(INT,SCOPE_IDENTITY()) AS Id;`,
          params,
          tx,
        );
        id = Number(result.recordset[0].Id);
      }
      if (name === 'usuarios' && body.roles !== undefined) {
        const roles = body.roles as string[];
        const roleParams = roles.map((role, index) =>
          text(`Role${index}`, 30, role),
        );
        const selected = await this.db.query(
          `SELECT IdRol FROM dbo.Rol WHERE Activo=1 AND Codigo IN (${roleParams.map((p) => `@${p.name}`).join(',')});`,
          roleParams,
          tx,
        );
        if (selected.recordset.length !== roles.length)
          throw invalid(
            'roles',
            'Todos los roles deben existir y estar activos.',
          );
        await this.db.query(
          'DELETE dbo.UsuarioRol WHERE IdUsuario=@Id;',
          [int('Id', id)],
          tx,
        );
        for (const role of selected.recordset)
          await this.db.query(
            'INSERT dbo.UsuarioRol(IdUsuario,IdRol) VALUES(@IdUsuario,@IdRol);',
            [int('IdUsuario', id), int('IdRol', role.IdRol)],
            tx,
          );
      }
      return this.one(name, id!, tx);
    });
  }
  private catalog(name: string) {
    if (!Object.prototype.hasOwnProperty.call(catalogs, name)) throw notFound();
    return catalogs[name as keyof typeof catalogs];
  }
  async catalogList(name: string) {
    const config = this.catalog(name);
    return publicRows(
      (
        await this.db.query(
          `SELECT ${config.columns} FROM dbo.${config.table} ORDER BY ${config.id};`,
        )
      ).recordset,
    );
  }
  async catalogSave(name: string, body: Record<string, unknown>, id?: number) {
    const config = this.catalog(name);
    const fields: FieldMap = config.fields;
    for (const [key, value] of Object.entries(body)) {
      if (!(key in fields))
        throw invalid(key, 'Campo no permitido para este catálogo.');
      const [, length] = fields[key];
      if (typeof value === 'string' && value.length > length && length > 0)
        throw invalid(key, `El máximo es ${length} caracteres.`);
    }
    if (!id && config.table === 'MetodoPago' && !body.codigo)
      throw invalid('codigo', 'El código es obligatorio.');
    return this.db.transaction(async (tx) => {
      const params = this.parameters(body, fields);
      if (id) {
        const found = await this.db.query(
          `SELECT ${config.id} FROM dbo.${config.table} WHERE ${config.id}=@Id;`,
          [int('Id', id)],
          tx,
        );
        if (!found.recordset.length) throw notFound();
        if (params.length)
          await this.db.query(
            `UPDATE dbo.${config.table} SET ${params.map((p) => `${p.name}=@${p.name}`).join(',')} WHERE ${config.id}=@Id;`,
            [...params, int('Id', id)],
            tx,
          );
      } else {
        const inserted = await this.db.query(
          `INSERT dbo.${config.table} (${params.map((p) => p.name).join(',')}) VALUES (${params.map((p) => `@${p.name}`).join(',')}); SELECT CONVERT(INT,SCOPE_IDENTITY()) AS Id;`,
          params,
          tx,
        );
        id = Number(inserted.recordset[0].Id);
      }
      return publicRow(
        (
          await this.db.query(
            `SELECT ${config.columns} FROM dbo.${config.table} WHERE ${config.id}=@Id;`,
            [int('Id', id)],
            tx,
          )
        ).recordset[0],
      );
    });
  }
  async catalogs() {
    const base: Record<string, unknown> = {};
    for (const [key, name] of [
      ['tiposEquipo', 'tipos-equipo'],
      ['marcas', 'marcas'],
      ['categoriasRepuesto', 'categorias-repuesto'],
      ['metodosPago', 'metodos-pago'],
    ])
      base[key] = await this.catalogList(name);
    for (const [key, columns, table] of [
      ['prioridades', 'IdPrioridad AS Id,Codigo,Nombre,Nivel', 'Prioridad'],
      [
        'estadosOrden',
        'IdEstadoOrden AS Id,Codigo,Nombre,EsFinal',
        'EstadoOrden',
      ],
      [
        'tiposMovimiento',
        'IdTipoMovimiento AS Id,Codigo,Nombre',
        'TipoMovimiento',
      ],
      ['roles', 'IdRol AS Id,Codigo,Nombre', 'Rol'],
    ])
      base[key] = publicRows(
        (
          await this.db.query(
            `SELECT ${columns} FROM dbo.${table}${table === 'Rol' ? ' WHERE Activo=1' : ''} ORDER BY Id;`,
          )
        ).recordset,
      );
    base.tecnicos = publicRows(
      (
        await this.db.query(
          "SELECT u.IdUsuario AS Id,u.NombreCompleto AS Nombre FROM dbo.Usuario u WHERE u.Activo=1 AND EXISTS(SELECT 1 FROM dbo.UsuarioRol ur JOIN dbo.Rol r ON r.IdRol=ur.IdRol WHERE ur.IdUsuario=u.IdUsuario AND r.Codigo='TECNICO' AND r.Activo=1) ORDER BY u.NombreCompleto,u.IdUsuario;",
        )
      ).recordset,
    );
    return base;
  }
}
