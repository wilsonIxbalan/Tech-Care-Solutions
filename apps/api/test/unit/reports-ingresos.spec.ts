import { ReportQuery } from '../../src/common/query.dto';
import { DatabaseService, Param } from '../../src/database/database.service';
import { publicRows } from '../../src/database/rows';
import { ReportsRepository } from '../../src/modules/reports/reports.repository';

const inv = (iso: string, total: number) => ({
  FechaFactura: new Date(iso), SubtotalManoObra: 10, SubtotalRepuestos: total - 10 - 0.1,
  Subtotal: total - 0.1, Impuesto: 0.1, Total: total,
});
const q = (extra: Partial<ReportQuery> = {}) => Object.assign(new ReportQuery(), extra);

describe('Reporte ingresos: agrupado por mes de Guatemala en TypeScript', () => {
  const query = jest.fn();
  const execute = jest.fn();
  const repo = new ReportsRepository({ query, execute } as unknown as DatabaseService);
  beforeEach(() => { query.mockReset(); execute.mockReset(); });
  const rows = (data: unknown[]) => query.mockResolvedValue({ recordset: data });

  it('2026-11-01T03:00Z cuenta en octubre; 06:00Z ya es noviembre; no usa el SP', async () => {
    rows([inv('2026-11-01T03:00:00Z', 100), inv('2026-11-01T06:00:00Z', 50), inv('2026-10-15T12:00:00Z', 20)]);
    const { sets, total } = await repo.paged('ingresos', q());
    expect(execute).not.toHaveBeenCalled();
    expect(total).toBe(2);
    expect(sets[0].map(r => [r.Anio, r.Mes, r.CantidadFacturas])).toEqual([[2026, 10, '2'], [2026, 11, '1']]);
    expect(publicRows(sets[0])[0]).toMatchObject({ anio: 2026, mes: 10, total: '120.00', cantidadFacturas: '2' });
  });

  it('filtra anuladas y cliente en SQL parametrizado', async () => {
    rows([]);
    await repo.paged('ingresos', q({ idCliente: 5, fechaDesde: '2026-10-01', fechaHasta: '2026-10-28' }));
    const [statement, params] = query.mock.calls[0] as [string, Param[]];
    expect(statement).toContain("Estado<>'ANULADA'");
    expect(statement).toContain('dbo.vw_Facturas');
    const b = Object.fromEntries(params.map(p => [p.name, p.value]));
    expect(b).toMatchObject({ IdCliente: 5, Desde: new Date('2026-10-01T06:00:00Z'), HastaExclusiva: new Date('2026-10-29T06:00:00Z') });
  });

  it('suma decimales sin error de coma flotante', async () => {
    rows([inv('2026-10-02T12:00:00Z', 0.1), inv('2026-10-03T12:00:00Z', 0.2), inv('2026-10-04T12:00:00Z', 0.2)]);
    const { sets } = await repo.paged('ingresos', q());
    expect(publicRows(sets[0])[0].total).toBe('0.50');
    expect(publicRows(sets[0])[0].impuesto).toBe('0.30');
  });

  it('search busca por subcadena en los montos y pagina', async () => {
    rows([inv('2026-08-10T12:00:00Z', 111.5), inv('2026-09-10T12:00:00Z', 222), inv('2026-10-10T12:00:00Z', 333)]);
    const found = await repo.paged('ingresos', q({ search: '222.00' }));
    expect(found.total).toBe(1);
    expect(found.sets[0][0].Mes).toBe(9);
    const page = await repo.paged('ingresos', q({ page: 2, pageSize: 2 }));
    expect(page.total).toBe(3);
    expect(page.sets[0].map(r => r.Mes)).toEqual([10]);
  });

  it('exporta todo sin Page y rechaza más de MaxRows con 413', async () => {
    rows([inv('2026-08-10T12:00:00Z', 1), inv('2026-09-10T12:00:00Z', 2)]);
    const sets = await repo.exportRows('ingresos', q(), 10000);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toHaveLength(2);
    const internal = repo as unknown as { run: (s: string, qq: ReportQuery, c: Param[]) => Promise<unknown> };
    await expect(internal.run('ingresos', q(), [{ name: 'MaxRows', type: undefined as never, value: 1 }]))
      .rejects.toMatchObject({ status: 413 });
  });
});
