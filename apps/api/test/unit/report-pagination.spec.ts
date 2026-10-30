import { ApiError } from '../../src/common/api-error';
import { ReportQuery } from '../../src/common/query.dto';
import { sqlError } from '../../src/common/sql-errors';
import { DatabaseService, Param } from '../../src/database/database.service';
import { ReadRepository } from '../../src/database/read.repository';
import { completeReports, reports, ReportsRepository } from '../../src/modules/reports/reports.repository';
import { ReportsService } from '../../src/modules/reports/reports.service';

const validQuery = (slug: string, extra: Partial<ReportQuery> = {}) => Object.assign(new ReportQuery(),
  slug === 'actividad-tecnico' ? { idTecnico: 7, fechaDesde: '2026-10-01', fechaHasta: '2026-10-28' }
    : slug === 'historial-cliente' ? { idCliente: 8 }
      : slug === 'historial-equipo' ? { numeroSerie: 'SERIE-DE-PRUEBA' }
        : slug === 'trazabilidad' ? { idOrden: 9 } : {}, extra);

describe('Reportes: paginacion y exportacion ejecutadas en SQL', () => {
  const execute = jest.fn();
  const repository = new ReportsRepository({ execute } as unknown as DatabaseService);
  const bindings = () => Object.fromEntries((execute.mock.calls[0][1] as Param[]).map(p => [p.name, p.value]));
  beforeEach(() => execute.mockReset());

  it.each(Object.keys(reports).filter(slug => !completeReports.has(slug)))('%s envía página y búsqueda tipadas; total viene de SQL', async slug => {
    const sets = slug === 'facturas-saldo' ? [[{ IdFactura: 4 }], [{ IdPago: 5, IdFactura: 4 }]] : [[{ Nombre: 'Fila' }]];
    execute.mockResolvedValue({ recordsets: [...sets, [{ TotalRows: 105 }]] });
    const result = await repository.paged(slug, validQuery(slug, { page: 3, pageSize: 10, search: "ñ'%_[]" }));
    expect(result).toEqual({ sets, total: 105 });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).not.toContain("ñ'%_[]");
    expect(bindings()).toMatchObject({ Page: 3, PageSize: 10, Search: "ñ'%_[]" });
    expect(bindings()).not.toHaveProperty('MaxRows');
  });

  it.each(Object.keys(reports))('%s exporta todos los filtros sin Page y limita la suma en SQL', async slug => {
    execute.mockResolvedValue({ recordsets: [[], []] });
    await repository.exportRows(slug, validQuery(slug, { page: 99, pageSize: 1 }), 10000);
    expect(bindings()).toMatchObject({ MaxRows: 10000 });
    expect(bindings()).not.toHaveProperty('Page');
    expect(bindings()).not.toHaveProperty('PageSize');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('conserva false y rangos de días de Guatemala en los parámetros', async () => {
    execute.mockResolvedValue({ recordsets: [[], [], [{ TotalRows: 0 }]] });
    await repository.paged('facturas-saldo', validQuery('facturas-saldo', { conSaldo: false, fechaDesde: '2026-10-01', fechaHasta: '2026-10-28' }));
    expect(bindings()).toMatchObject({ ConSaldo: false, Desde: new Date('2026-10-01T06:00:00Z'), HastaExclusiva: new Date('2026-10-29T06:00:00Z') });
  });

  it('pagina vacía conserva total, conteo bigint textual y resultsets originales', async () => {
    const sets = [[], [{ TotalRows: '100' }]];
    execute.mockResolvedValue({ recordsets: sets });
    expect(await repository.paged('inventario', validQuery('inventario', { page: 6 }))).toEqual({ sets: [[]], total: 100 });
    expect(sets).toHaveLength(2);
  });

  it.each([undefined, null, -1, 1.5, true, 'no', '9007199254740992'])('rechaza metadato inválido %j sin volver a consultar', async total => {
    execute.mockResolvedValue({ recordsets: [[], [{ TotalRows: total }]] });
    await expect(repository.paged('inventario', validQuery('inventario'))).rejects.toMatchObject({ status: 503 });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rechaza una forma de resultsets incompatible en lugar de paginar silenciosamente en memoria', async () => {
    execute.mockResolvedValue({ recordsets: [[], [{ TotalRows: 0 }]] });
    await expect(repository.paged('facturas-saldo', validQuery('facturas-saldo'))).rejects.toMatchObject({ status: 503 });
  });

  it.each([{ page: 0 }, { page: 1.5 }, { page: 2147483648 }, { pageSize: 0 }, { pageSize: 101 }])('valida página %j antes de SQL', async extra => {
    await expect(repository.paged('inventario', validQuery('inventario', extra))).rejects.toMatchObject({ status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([0, 10001, 1.5])('rechaza límite interno %s antes de SQL', async limit => {
    await expect(repository.exportRows('inventario', validQuery('inventario'), limit)).rejects.toMatchObject({ status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([...completeReports])('%s no admite search ni recorta relaciones completas', async slug => {
    await expect(repository.exportRows(slug, validQuery(slug, { search: 'texto' }), 10000)).rejects.toMatchObject({ status: 400 });
    await expect(repository.paged(slug, validQuery(slug))).rejects.toMatchObject({ status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([8144, 8145])('SP antiguo (%s) devuelve instrucción segura, sin fallback ni texto SQL', async number => {
    execute.mockRejectedValue({ code: 'EREQUEST', number, message: 'PRIVATE-CANARY' });
    try {
      await repository.paged('inventario', validQuery('inventario'));
      throw new Error('Debe fallar sin migracion');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).getStatus()).toBe(503);
      expect(JSON.stringify((error as ApiError).getResponse())).not.toContain('PRIVATE-CANARY');
      expect((error as Error).message).toContain('procedimientos SQL');
    }
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('traduce el rechazo SQL 51710 a 413 de exportación sin truncar', () => {
    expect(sqlError(51710)).toMatchObject({ status: 413, code: 'EXPORTACION_DEMASIADO_GRANDE' });
  });
});

describe('Servicio de reportes: no busca ni pagina de nuevo los resultados SQL', () => {
  const paged = jest.fn();
  const execute = jest.fn();
  const service = new ReportsService({ paged, execute } as unknown as ReportsRepository, {} as ReadRepository);
  beforeEach(() => jest.resetAllMocks());
  it('conserva filas devueltas en página 3 y el total completo', async () => {
    paged.mockResolvedValue({ sets: [[{ IdRepuesto: 41, PrecioVenta: 10.5 }]], total: 105 });
    const query = validQuery('inventario', { page: 3, pageSize: 10, search: 'texto ya filtrado' });
    expect(await service.report('inventario', query)).toEqual({ data: [{ idRepuesto: 41, precioVenta: '10.50' }], meta: { page: 3, pageSize: 10, total: 105, totalPages: 11 } });
    expect(paged).toHaveBeenCalledWith('inventario', query);
    expect(execute).not.toHaveBeenCalled();
  });
  it('agrupa pagos de la página sin multiplicar importes ni adjuntar pagos ajenos', async () => {
    paged.mockResolvedValue({ sets: [
      [{ IdFactura: 2, Total: 30 }, { IdFactura: 3, Total: 20 }],
      [{ IdPago: 7, IdFactura: 2, Monto: 5 }, { IdPago: 8, IdFactura: 2, Monto: 10 }, { IdPago: 9, IdFactura: 99, Monto: 1 }],
    ], total: 200 });
    const result = await service.report('facturas-saldo', validQuery('facturas-saldo'));
    expect(result).toMatchObject({ meta: { total: 200 }, data: [
      { idFactura: 2, total: '30.00', pagos: [{ idPago: 7, monto: '5.00' }, { idPago: 8, monto: '10.00' }] },
      { idFactura: 3, total: '20.00', pagos: [] },
    ] });
  });
});
