import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { invalid } from '../../common/api-error';
import { MasterQuery } from '../../common/query.dto';
import { MasterName, masters } from './masters.config';
import { MastersRepository } from './masters.repository';
@Injectable()
export class MastersService {
  constructor(private readonly repository: MastersRepository) {}
  list(name: MasterName, query: MasterQuery) {
    const allowed = new Set([
      'page',
      'pageSize',
      'search',
      ...Object.keys(masters[name].fields).filter((key) =>
        ['estado', 'idCliente', 'idCategoria', 'activo'].includes(key),
      ),
    ]);
    for (const key of Object.keys(query))
      if (!allowed.has(key))
        throw invalid(key, 'Este filtro no corresponde al recurso.');
    return this.repository.list(name, query);
  }
  one(name: MasterName, id: number) {
    return this.repository.one(name, id);
  }
  async save(name: MasterName, dto: object, id?: number, actor?: number) {
    const body = { ...dto } as Record<string, unknown>;
    if (id && !Object.keys(body).length)
      throw invalid('body', 'Envía al menos un campo para actualizar.');
    if (name === 'usuarios' && typeof body.password === 'string') {
      body.passwordHash = await argon2.hash(body.password, {
        type: argon2.argon2id,
      });
      delete body.password;
    }
    return this.repository.save(name, body, id, actor);
  }
  catalogs() {
    return this.repository.catalogs();
  }
  catalogList(name: string) {
    return this.repository.catalogList(name);
  }
  catalogSave(name: string, dto: object, id?: number) {
    if (id && !Object.keys(dto).length)
      throw invalid('body', 'Envía al menos un campo para actualizar.');
    return this.repository.catalogSave(name, { ...dto }, id);
  }
}
