import { ReportsRepository } from '../../src/modules/reports/reports.repository';
import { ReportQuery } from '../../src/common/query.dto';
import { DatabaseService } from '../../src/database/database.service';

describe('Filtros coherentes de reportes relacionados (sin SQL)', () => {
  const execute = jest.fn();
  const repository = new ReportsRepository({ execute } as unknown as DatabaseService);

  beforeEach(() => jest.clearAllMocks());

  it.each(['historial-cliente', 'historial-equipo', 'trazabilidad'])(
    '%s no ignora search ni recorta relaciones independientes',
    async (slug) => {
      const query = Object.assign(new ReportQuery(), { search: 'texto' });
      await expect(repository.execute(slug, query)).rejects.toMatchObject({
        status: 400,
        response: { code: 'VALIDACION', details: { search: expect.any(Array) } },
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );
});
