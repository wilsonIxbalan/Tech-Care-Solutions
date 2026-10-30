// Lista explícita de los THROW de fases 07/08/09. Nunca exponer el texto del motor.
const groups: Array<[number[], number, string, string]> = [
  [[51710], 413, 'EXPORTACION_DEMASIADO_GRANDE', 'La exportación supera 10000 filas en total. Ajusta los filtros; no se ha truncado ningún conjunto.'],
  [
    [
      50100, 50300, 50400, 50500, 50602, 50800, 51000, 51103, 51202, 51300,
      51400, 51602,
    ],
    404,
    'NO_ENCONTRADO',
    'El registro no existe o ya no está disponible.',
  ],
  [[50101], 403, 'USUARIO_INACTIVO', 'El usuario no está disponible.'],
  [
    [
      50112, 50202, 50302, 50402, 50502, 50601, 50702, 50802, 50904, 51002,
      51101, 51201, 51303, 51401, 51501, 51600, 52030, 52031, 52076,
    ],
    403,
    'PERMISO_DENEGADO',
    'No tienes permiso para esta acción.',
  ],
  [
    [
      50102, 50203, 50204, 50205, 50303, 50304, 50403, 50404, 50600, 50703,
      50704, 50900, 50901, 50902, 50903, 51004, 51100, 51200, 51302, 51403,
      51500, 51601, 51700,
    ],
    400,
    'VALIDACION',
    'Los parámetros de la operación no son válidos.',
  ],
  [
    [50607, 50907, 50908],
    409,
    'STOCK_INSUFICIENTE',
    'No hay suficientes unidades en la bodega seleccionada.',
  ],
  [
    [51105, 52002],
    409,
    'PAGO_EXCEDE_SALDO',
    'El pago excede el saldo pendiente.',
  ],
  [
    [50109],
    409,
    'ORDEN_CON_SALDO',
    'La factura de la orden tiene saldo pendiente.',
  ],
  [
    [50103, 52021],
    409,
    'TRANSICION_INVALIDA',
    'La transición de estado no está permitida.',
  ],
  [
    [50113],
    409,
    'ORDEN_FACTURADA',
    'La orden ya tiene una factura y no admite nuevos trabajos.',
  ],
  [[50206], 409, 'ORDEN_ABIERTA', 'El equipo ya tiene una orden abierta.'],
  [[51003], 409, 'FACTURA_EXISTENTE', 'La orden ya tiene una factura.'],
  [[2601, 2627], 409, 'DUPLICADO', 'Ya existe un registro con esos datos.'],
  [
    [547],
    409,
    'CONFLICTO_INTEGRIDAD',
    'Los datos entran en conflicto con un registro relacionado.',
  ],
  [
    [1205],
    409,
    'CONFLICTO_CONCURRENCIA',
    'La transacción fue revertida por concurrencia. Actualiza los datos antes de repetir.',
  ],
  [
    [
      50104, 50105, 50106, 50107, 50108, 50110, 50111, 50200, 50201, 50301,
      50305, 50401, 50405, 50501, 50603, 50604, 50606, 50608, 50700, 50701,
      50706, 50801, 50803, 50804, 50805, 50905, 50906, 51001, 51005, 51102,
      51104, 51203, 51204, 51205, 51301, 51402, 51502, 51503, 52001, 52050,
      52055, 52056, 52059, 52065, 52068, 52072, 52075,
    ],
    409,
    'CONFLICTO_NEGOCIO',
    'El estado actual de los datos no permite esta operación.',
  ],
];
export function sqlError(number: number) {
  const match = groups.find(([numbers]) => numbers.includes(number));
  return match
    ? { status: match[1], code: match[2], message: match[3] }
    : undefined;
}
