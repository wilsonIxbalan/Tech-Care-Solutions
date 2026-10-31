import { ServiceService } from '../../src/modules/service/service.service';
import { ServiceRepository } from '../../src/modules/service/service.repository';
import { ReadRepository } from '../../src/database/read.repository';
import { SessionUser } from '../../src/modules/auth/auth.dto';
import { ApiError } from '../../src/common/api-error';

describe('fecha estimada de órdenes en Guatemala', () => {
  const create = jest.fn();
  const service = new ServiceService({ create } as unknown as ServiceRepository, {} as ReadRepository);
  const dto = { idCliente: 1, idEquipo: 2, idPrioridad: 3, problemaReportado: 'No enciende' };
  const user = { idUsuario: 4 } as SessionUser;
  beforeEach(() => { create.mockReset(); jest.useFakeTimers().setSystemTime(new Date('2026-11-01T03:00:00Z')); });
  afterEach(() => jest.useRealTimers());
  it.each([null, undefined, '2026-10-31', '2026-11-01'])('permite hoy en Guatemala, futuro u omisión: %s', fechaEstimada => {
    service.create({ ...dto, fechaEstimada }, user);
    expect(create).toHaveBeenCalledWith({ ...dto, fechaEstimada }, 4);
  });
  it('rechaza una fecha pasada antes de llegar al repositorio e identifica el campo', () => {
    try {
      service.create({ ...dto, fechaEstimada: '2026-10-30' }, user);
      throw new Error('Se esperaba rechazo');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).getResponse()).toMatchObject({ details: { fechaEstimada: [expect.stringContaining('2026-10-31, hora de Guatemala')] } });
    }
    expect(create).not.toHaveBeenCalled();
  });
});
