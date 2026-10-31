import * as sql from 'mssql';
import { DatabaseService, Row } from '../../../src/database/database.service';
import { ReadRepository } from '../../../src/database/read.repository';

describe('ReadRepository.orderDetails', () => {
  const query = jest.fn();
  const repository = new ReadRepository({
    query,
  } as unknown as DatabaseService);
  beforeEach(() => query.mockReset());

  it('loads all relations in one parameterized batch, preserving DTOs and input/child order', async () => {
    const sets: Row[][] = [
      [{ IdOrden: 1, Observaciones: null }, { IdOrden: 2 }, { IdOrden: 3 }],
      [
        {
          IdReparacion: 10,
          IdOrden: 1,
          IdDiagnostico: null,
          CostoManoObra: 27.5,
        },
        { IdReparacion: 11, IdOrden: 2 },
        { IdReparacion: 12, IdOrden: 1 },
      ],
      [
        { IdActividad: 5, IdReparacion: 10, HorasInvertidas: 1.5 },
        { IdActividad: 6, IdReparacion: 11 },
        { IdActividad: 7, IdReparacion: 10 },
      ],
      [
        {
          IdRepuestoReparacion: 8,
          IdReparacion: 12,
          IdOrden: 1,
          Cantidad: 3,
          PrecioCostoUnitario: 4.5,
          PrecioVentaUnitario: 8,
          Subtotal: 19,
        },
      ],
      [
        { IdHistorial: 1, IdOrden: 1, EstadoAnterior: null },
        { IdHistorial: 2, IdOrden: 2 },
      ],
      [{ IdDiagnostico: 20, IdOrden: 2 }],
      [
        { IdFactura: 30, IdOrden: 1, Total: 99.99 },
        { IdFactura: 31, IdOrden: 2, Total: 0 },
      ],
      [
        {
          IdDetalleFactura: 40,
          IdFactura: 30,
          TipoLinea: 'REPUESTO',
          IdReparacion: null,
          Cantidad: 3,
          PrecioUnitario: 8,
          Subtotal: 19,
        },
      ],
      [{ IdPago: 50, IdFactura: 30, Monto: 9.99, Referencia: null }],
      [
        { IdEntrega: 60, IdOrden: 1 },
        { IdEntrega: 61, IdOrden: 1 },
      ],
    ];
    query.mockResolvedValue({ recordsets: sets });
    const tx = {} as sql.Transaction;
    const result = await repository.orderDetails([2, 1, 3], tx);
    expect(query).toHaveBeenCalledTimes(1);
    const [statement, parameters, transaction] = query.mock.calls[0] as [
      string,
      unknown[],
      unknown,
    ];
    expect(statement).toContain('OPENJSON(@Ids)');
    expect(statement.match(/SELECT /g)?.length).toBeGreaterThan(10);
    expect(statement).not.toMatch(/SELECT\s+\*|OFFSET|FETCH|TOP\s*\(/i);
    expect(parameters).toEqual([
      expect.objectContaining({ name: 'Ids', value: '[2,1,3]' }),
    ]);
    expect(transaction).toBe(tx);
    expect(result).toEqual([
      {
        idOrden: 2,
        historial: [{ idHistorial: 2, idOrden: 2 }],
        diagnosticos: [{ idDiagnostico: 20, idOrden: 2 }],
        reparaciones: [
          {
            idReparacion: 11,
            idOrden: 2,
            actividades: [{ idActividad: 6, idReparacion: 11 }],
            repuestos: [],
          },
        ],
        factura: {
          idFactura: 31,
          idOrden: 2,
          total: '0.00',
          detalles: [],
          pagos: [],
        },
        entrega: null,
      },
      {
        idOrden: 1,
        observaciones: null,
        historial: [{ idHistorial: 1, idOrden: 1, estadoAnterior: null }],
        diagnosticos: [],
        reparaciones: [
          {
            idReparacion: 10,
            idOrden: 1,
            idDiagnostico: null,
            costoManoObra: '27.50',
            actividades: [
              { idActividad: 5, idReparacion: 10, horasInvertidas: '1.50' },
              { idActividad: 7, idReparacion: 10 },
            ],
            repuestos: [],
          },
          {
            idReparacion: 12,
            idOrden: 1,
            actividades: [],
            repuestos: [
              {
                idRepuestoReparacion: 8,
                idReparacion: 12,
                idOrden: 1,
                cantidad: 3,
                precioCostoUnitario: '4.50',
                precioVentaUnitario: '8.00',
                subtotal: '19.00',
              },
            ],
          },
        ],
        factura: {
          idFactura: 30,
          idOrden: 1,
          total: '99.99',
          detalles: [
            {
              idDetalleFactura: 40,
              idFactura: 30,
              tipoLinea: 'REPUESTO',
              idReparacion: null,
              cantidad: '3.00',
              precioUnitario: '8.00',
              subtotal: '19.00',
            },
          ],
          pagos: [
            { idPago: 50, idFactura: 30, monto: '9.99', referencia: null },
          ],
        },
        entrega: { idEntrega: 60, idOrden: 1 },
      },
      {
        idOrden: 3,
        historial: [],
        diagnosticos: [],
        reparaciones: [],
        factura: null,
        entrega: null,
      },
    ]);
  });

  it('returns empty input without SQL', async () => {
    await expect(repository.orderDetails([])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    2147483648,
    '1',
    '1); DROP TABLE Ordenes;',
  ])('rejects invalid ID %s before SQL', async (id) => {
    await expect(
      repository.orderDetails([1, id as number]),
    ).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });

  it('supports the SQL int maximum and repeated IDs in caller order', async () => {
    query.mockResolvedValue({
      recordsets: [
        [{ IdOrden: 2147483647 }],
        ...Array.from({ length: 9 }, () => []),
      ],
    });
    const result = await repository.orderDetails([2147483647, 2147483647]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(result[1]);
    expect(query.mock.calls[0][1]).toEqual([
      expect.objectContaining({ value: '[2147483647]' }),
    ]);
  });

  it('keeps single-order not-found semantics', async () => {
    query.mockResolvedValue({
      recordsets: Array.from({ length: 10 }, () => []),
    });
    await expect(repository.orderDetail(42)).rejects.toMatchObject({
      status: 404,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
