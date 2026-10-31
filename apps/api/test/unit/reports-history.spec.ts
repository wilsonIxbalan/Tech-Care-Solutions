import { ReportQuery } from '../../src/common/query.dto';
import { ReadRepository } from '../../src/database/read.repository';
import { ReportsRepository } from '../../src/modules/reports/reports.repository';
import { ReportsService } from '../../src/modules/reports/reports.service';

describe('ReportsService history batching', () => {
  const execute = jest.fn();
  const orderDetails = jest.fn();
  const orderDetail = jest.fn();
  const service = new ReportsService(
    { execute } as unknown as ReportsRepository,
    { orderDetails, orderDetail } as unknown as ReadRepository,
  );
  beforeEach(() => jest.resetAllMocks());

  it.each(['historial-cliente', 'historial-equipo'])(
    '%s uses one batch in original deduplicated order',
    async (slug) => {
      execute.mockResolvedValue([
        [{ Nombre: 'Ejemplo' }],
        [{ IdOrden: 7 }, { IdOrden: null }, { IdOrden: 3 }, { IdOrden: 7 }],
      ]);
      const orders = [
        { idOrden: 7, reparaciones: [{ actividades: [1, 2, 3] }] },
        { idOrden: 3 },
      ];
      orderDetails.mockResolvedValue(orders);
      const result = await service.report(slug, {
        page: 2,
        pageSize: 1,
      } as ReportQuery);
      expect(orderDetails).toHaveBeenCalledTimes(1);
      expect(orderDetails).toHaveBeenCalledWith([7, 3]);
      expect(orderDetail).not.toHaveBeenCalled();
      expect(result).toEqual({
        [slug === 'historial-cliente' ? 'cliente' : 'equipo']: {
          nombre: 'Ejemplo',
        },
        ordenes: orders,
      });
    },
  );

  it('preserves a parent with no orders', async () => {
    execute.mockResolvedValue([[{ IdCliente: 1 }], [{ IdOrden: null }]]);
    orderDetails.mockResolvedValue([]);
    await expect(
      service.report('historial-cliente', {} as ReportQuery),
    ).resolves.toEqual({ cliente: { idCliente: 1 }, ordenes: [] });
    expect(orderDetails).toHaveBeenCalledWith([]);
  });

  it('preserves not-found for a missing parent', async () => {
    execute.mockResolvedValue([[], []]);
    await expect(
      service.report('historial-equipo', {} as ReportQuery),
    ).rejects.toMatchObject({ status: 404 });
    expect(orderDetails).not.toHaveBeenCalled();
  });
});
