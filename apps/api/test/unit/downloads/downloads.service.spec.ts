import { Workbook } from 'exceljs';
import { ApiError } from '../../../src/common/api-error';
import { ReadRepository } from '../../../src/database/read.repository';
import { ReportsRepository } from '../../../src/modules/reports/reports.repository';
import { ReportExportQuery } from '../../../src/modules/downloads/downloads.dto';
import { DownloadsService } from '../../../src/modules/downloads/downloads.service';

describe('DownloadsService sin BD', () => {
  const execute = jest.fn();
  const invoiceDetail = jest.fn();
  const service = new DownloadsService(
    { exportRows: execute } as unknown as ReportsRepository,
    { invoiceDetail } as unknown as ReadRepository,
  );
  const query = (extra: Partial<ReportExportQuery> = {}) => Object.assign(new ReportExportQuery(), { formato: 'csv', conjunto: 1 }, extra);
  beforeEach(() => jest.resetAllMocks());

  it('exporta todo, no sólo página; limpia formato/conjunto y conserva filtros', async () => {
    execute.mockResolvedValue([[{ IdRepuesto: '0001', Total: 0, Fecha: new Date('2026-10-26T06:00:00Z') }, { IdRepuesto: '0002', Total: 2.3 }]]);
    const result = await service.report('inventario', query({ page: 9, pageSize: 1, idBodega: 3 }));
    expect(execute).toHaveBeenCalledWith('inventario', { page: 9, pageSize: 1, idBodega: 3 }, 10000);
    expect(result.buffer.toString()).toContain('"0001","0.00","2026-10-26T00:00:00.000-06:00"');
    expect(result.buffer.toString()).toContain('"0002","2.30",""');
    expect(result.filename).toBe('inventario-conjunto-1.csv');
  });

  it('envía search a SQL y conserva los resultados ya filtrados sin filtrar de nuevo', async () => {
    execute.mockResolvedValue([[{ Nombre: 'TÉCNICO', Total: 12.3 }]]);
    const result = await service.report('actividad-tecnico', query({ search: 'técn' }));
    expect(result.buffer.toString()).toContain('TÉCNICO');
    expect(result.buffer.toString()).not.toContain('Otro');
    const byAmount = await service.report('actividad-tecnico', query({ search: '12.30' }));
    expect(byAmount.buffer.toString()).toContain('TÉCNICO');
    expect(execute).toHaveBeenCalledWith('actividad-tecnico', expect.objectContaining({ search: '12.30' }), 10000);
  });

  it('facturas-saldo conserva pagos sólo de facturas coincidentes sin buscar referencias de pago', async () => {
    execute.mockResolvedValue([
      [{ IdFactura: 1, ClienteNombre: 'Ana' }],
      [{ IdFactura: 1, Referencia: 'ref-uno' }],
    ]);
    const result = await service.report('facturas-saldo', query({ search: 'ana', conjunto: 2 }));
    expect(result.buffer.toString()).toContain('ref-uno');
    expect(result.buffer.toString()).not.toContain('pago-ajeno');
    expect(execute).toHaveBeenCalledWith('facturas-saldo', expect.objectContaining({ search: 'ana' }), 10000);
  });

  it('XLSX incluye cada resultset y excluye campos privados por publicRows', async () => {
    execute.mockResolvedValue([[{ Id: 1, PasswordHash: 'nunca-exportar', TotalRows: 99 }], [{ Monto: 0 }]]);
    const result = await service.report('ingresos', query({ formato: 'xlsx', conjunto: undefined }));
    const workbook = new Workbook();
    await workbook.xlsx.load(result.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.worksheets).toHaveLength(2);
    expect(workbook.worksheets[0].name).toBe('Ingresos facturados');
    expect(workbook.worksheets[0].getRow(1).values).toEqual([undefined, 'id']);
    expect(workbook.worksheets[1].getCell('A2').value).toBe('0.00');
  });

  it('conserva encabezados del metadato de un conjunto vacío', async () => {
    const rows = Object.assign([], { columns: { IdFactura: {}, Saldo: {}, PasswordHash: {} } });
    execute.mockResolvedValue([rows]);
    const result = await service.report('facturas-saldo', query());
    expect(result.buffer.toString()).toBe('\uFEFF"idFactura","saldo"\r\n');
  });

  it('10000 filas permitidas, 10001 rechazadas sin truncar y contando todos los conjuntos', async () => {
    execute.mockResolvedValue([Array.from({ length: 10000 }, (_, id) => ({ Id: id }))]);
    const result = await service.report('inventario', query());
    expect(result.buffer.toString().split('\r\n')).toHaveLength(10002);
    execute.mockResolvedValue([Array.from({ length: 10000 }, (_, id) => ({ Id: id })), [{ Id: 10000 }]]);
    await expect(service.report('inventario', query())).rejects.toMatchObject({
      response: { code: 'EXPORTACION_DEMASIADO_GRANDE' },
      status: 413,
    });
  });

  it('el límite se aplica en SQL después de search; no carga filas descartadas', async () => {
    execute.mockResolvedValue([[{ Nombre: 'buscado' }]]);
    const result = await service.report('inventario', query({ search: 'buscado' }));
    expect(result.buffer.toString()).toBe('\uFEFF"nombre"\r\n"buscado"\r\n');
    expect(execute).toHaveBeenCalledWith('inventario', expect.objectContaining({ search: 'buscado' }), 10000);
  });

  it('requiere conjunto CSV, rechaza conjunto fuera de rango y selección en XLSX', async () => {
    execute.mockResolvedValue([[]]);
    await expect(service.report('inventario', query({ conjunto: undefined }))).rejects.toBeInstanceOf(ApiError);
    await expect(service.report('inventario', query({ conjunto: 2 }))).rejects.toBeInstanceOf(ApiError);
    await expect(service.report('inventario', query({ formato: 'xlsx' }))).rejects.toBeInstanceOf(ApiError);
  });

  it('historial inexistente conserva 404 y errores del repositorio no se ocultan', async () => {
    execute.mockResolvedValue([[]]);
    await expect(service.report('historial-cliente', query())).rejects.toMatchObject({ status: 404 });
    execute.mockRejectedValue(new ApiError(400, 'VALIDACION', 'Filtro incorrecto.'));
    await expect(service.report('inventario', query())).rejects.toMatchObject({ status: 400 });
  });

  it('PDF sólo lee detalle persistido y nombre de archivo no usa datos fiscales', async () => {
    invoiceDetail.mockResolvedValue({ numeroFactura: '001', nitFacturacion: 'CF', total: '91.07', detalles: [], pagos: [] });
    const result = await service.invoice(7);
    expect(invoiceDetail).toHaveBeenCalledWith(7);
    expect(result.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(result.filename).toBe('factura-simulada-7.pdf');
  });
});
