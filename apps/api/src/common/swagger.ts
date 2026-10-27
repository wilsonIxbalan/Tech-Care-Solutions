import { OpenAPIObject } from '@nestjs/swagger';
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { reports } from '../modules/reports/reports.repository';

const ref = (name: string): SchemaObject => ({
  allOf: [{ $ref: `#/components/schemas/${name}` }],
});
const array = (name: string): SchemaObject => ({
  type: 'array',
  items: ref(name),
});
const nullableRef = (name: string): SchemaObject => ({
  ...ref(name),
  nullable: true,
});
function model(
  fields: string,
  extra: Record<string, SchemaObject> = {},
): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  for (const item of fields.split(/\s+/).filter(Boolean)) {
    const [raw, type = 'string'] = item.split(':');
    const nullable = raw.endsWith('?');
    const key = raw.replace(/\?$/, '');
    properties[key] =
      type === 'int'
        ? { type: 'integer' }
        : type === 'bool'
          ? { type: 'boolean' }
          : type === 'money'
            ? {
                type: 'string',
                pattern: '^-?\\d+\\.\\d{2}$',
                example: '125.50',
              }
            : type === 'date'
              ? { type: 'string', format: 'date' }
              : type === 'time'
                ? { type: 'string', format: 'date-time' }
                : { type: 'string' };
    if (nullable) properties[key].nullable = true;
  }
  Object.assign(properties, extra);
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
const definitions: Record<string, SchemaObject> = {
  SessionUser: model('idUsuario:int nombreUsuario nombreCompleto', {
    roles: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'BODEGA', 'CAJA'],
      },
    },
    permisos: { type: 'array', items: { type: 'string' } },
  }),
  LoginResult: model('expiresIn:int', { usuario: ref('SessionUser') }),
  Client: model(
    'idCliente:int tipoCliente nit nombres? apellidos? razonSocial? nombreContacto? nombreMostrar telefono email? direccion? estado fechaRegistro:time',
  ),
  Equipment: model(
    'idEquipo:int idCliente:int clienteNombre idTipoEquipo:int tipoEquipoNombre idMarca:int marcaNombre modelo numeroSerie descripcion estado fechaRegistro:time',
  ),
  Part: model(
    'idRepuesto:int idCategoria:int codigo nombre descripcion? precioCompraReferencia:money precioVenta:money estado',
  ),
  Supplier: model(
    'idProveedor:int nit nombre nombreContacto? telefono email? direccion? estado',
  ),
  Warehouse: model('idBodega:int codigo nombre ubicacion? estado'),
  User: model(
    'idUsuario:int nombreUsuario nombreCompleto email telefono? activo:bool fechaCreacion:time ultimoAcceso?:time',
    { roles: { type: 'array', items: { type: 'string' } } },
  ),
  Catalog: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      codigo: { type: 'string' },
      nombre: { type: 'string' },
      descripcion: { type: 'string', nullable: true },
      activo: { type: 'boolean' },
      nivel: { type: 'integer' },
      esFinal: { type: 'boolean' },
    },
    required: ['id', 'nombre'],
  },
  Catalogs: model(
    '',
    Object.fromEntries(
      [
        'tiposEquipo',
        'marcas',
        'prioridades',
        'estadosOrden',
        'categoriasRepuesto',
        'metodosPago',
        'tiposMovimiento',
        'roles',
        'tecnicos',
      ].map((key) => [key, array('Catalog')]),
    ),
  ),
  Order: model(
    'idOrden:int numeroOrden idCliente:int clienteNombre idEquipo:int numeroSerie idUsuarioRecepcion:int fechaIngreso:time problemaReportado idPrioridad:int prioridad estado fechaEstimada?:date observaciones?',
  ),
  History: model(
    'idHistorial:int idOrden:int estadoAnterior? estadoNuevo fechaCambio:time idUsuario:int usuarioNombre observacion?',
  ),
  Diagnosis: model(
    'idDiagnostico:int idOrden:int idTecnico:int tecnicoNombre fechaDiagnostico:time descripcion costoManoObraEstimado:money estado',
  ),
  Activity: model(
    'idActividad:int idReparacion:int idTecnico:int tecnicoNombre descripcion fechaActividad:time horasInvertidas:money',
  ),
  Consumption: model(
    'idRepuestoReparacion:int idReparacion:int idOrden:int idBodega:int bodegaNombre idRepuesto:int codigoRepuesto repuestoNombre cantidad:int precioCostoUnitario:money precioVentaUnitario:money subtotal:money fechaAsignacion:time idUsuario:int estado',
  ),
  Repair: model(
    'idReparacion:int idOrden:int idDiagnostico:int idTecnico:int tecnicoNombre fechaInicio:time fechaFin?:time descripcion costoManoObra:money estado',
    { actividades: array('Activity'), repuestos: array('Consumption') },
  ),
  Invoice: model(
    'idFactura:int numeroFactura idOrden:int numeroOrden idCliente:int clienteNombre nitFacturacion nombreFacturacion direccionFacturacion? fechaFactura:time subtotalManoObra:money subtotalRepuestos:money porcentajeImpuesto:money subtotal:money impuesto:money total:money totalPagado:money saldo:money estado',
  ),
  InvoiceLine: model(
    'idDetalleFactura:int idFactura:int tipoLinea idReparacion?:int idRepuestoReparacion?:int descripcion cantidad:money precioUnitario:money subtotal:money',
  ),
  Payment: model(
    'idPago:int idFactura:int idMetodoPago:int metodoPagoNombre monto:money fechaPago:time referencia? idUsuario:int usuarioNombre estado motivoAnulacion?',
  ),
  Delivery: model(
    'idEntrega:int idOrden:int idUsuarioEntrega:int usuarioEntregaNombre nombreRecibe documentoRecibe? fechaEntrega:time observaciones?',
  ),
  Purchase: model(
    'idCompra:int numeroCompra idProveedor:int proveedorNombre idBodegaDestino:int bodegaNombre idUsuarioRegistro:int fechaCompra:time fechaRecepcion?:time idUsuarioRecepcion?:int numeroDocumentoProveedor? estado observaciones? total:money',
  ),
  PurchaseItemRead: model(
    'idDetalleCompra:int idCompra:int idRepuesto:int codigoRepuesto repuestoNombre cantidad:int costoUnitario:money subtotal:money',
  ),
  Inventory: model(
    'idBodega:int bodegaNombre idCategoria:int categoriaNombre idRepuesto:int codigoRepuesto repuestoNombre existencia:int stockMinimo:int bajoMinimo:bool sinStock:bool fechaUltimoMovimiento?:time',
  ),
  Movement: model(
    'idMovimiento:int idBodega:int bodegaNombre idRepuesto:int codigoRepuesto repuestoNombre codigoTipoMovimiento naturaleza cantidad:int fechaMovimiento:time idUsuario:int usuarioNombre documentoOrigen numeroDocumento existenciaResultante:int observacion?',
  ),
  Dashboard: model(
    'ordenesAbiertas:int ordenesEnDiagnostico:int ordenesEnReparacion:int ordenesListas:int facturasConSaldo:int repuestosBajoMinimo:int',
    { actividadReciente: array('RecentActivity') },
  ),
  RecentActivity: model('tipo descripcion fecha:time'),
  ReportActive: model(
    'idOrden:int numeroOrden fechaIngreso:time fechaEstimada?:date estado prioridad clienteNombre numeroSerie tipoEquipo marca idTecnico?:int tecnicoResponsable?',
  ),
  ReportTechnician: model(
    'tipo idRegistro:int idOrden:int numeroOrden numeroSerie idTecnico:int tecnicoNombre fecha:time descripcion costo:money estado',
  ),
  ReportConsumed: model(
    'idRepuestoReparacion:int idOrden:int numeroOrden idReparacion:int idTecnico:int tecnicoNombre idBodega:int bodegaNombre codigo repuestoNombre cantidad:int precioCostoUnitario:money precioVentaUnitario:money subtotal:money estado',
  ),
  ReportInventory: model(
    'idBodega:int bodegaNombre idCategoria:int categoriaNombre idRepuesto:int codigo repuestoNombre existencia:int stockMinimo:int fechaUltimoMovimiento?:time',
  ),
  ReportMinimum: model(
    'idBodega:int bodegaNombre categoriaNombre idRepuesto:int codigo repuestoNombre existencia:int stockMinimo:int',
  ),
  ReportPurchases: model(
    'idCompra:int numeroCompra fechaCompra:time estado idProveedor:int proveedorNombre bodegaNombre usuarioRegistro idDetalleCompra:int codigo repuestoNombre cantidad:int costoUnitario:money subtotal:money',
  ),
  ReportMovement: model(
    'idMovimiento:int fechaMovimiento:time idBodega:int bodegaNombre idRepuesto:int codigoRepuesto repuestoNombre tipoMovimiento naturaleza cantidad:int existenciaResultante:int documentoOrigen numeroDocumento usuarioNombre observacion?',
  ),
  ReportInvoicePayment: model(
    'idPago:int idFactura:int fechaPago:time monto:money metodoPago referencia? estado usuarioNombre',
  ),
  ReportInvoices: model(
    'idFactura:int numeroFactura idOrden:int numeroOrden clienteNombre fechaFactura:time estado total:money totalPagado:money saldo:money',
    { pagos: array('ReportInvoicePayment') },
  ),
  ReportIncome: model(
    'anio:int mes:int cantidadFacturas:int totalManoObra:money totalRepuestos:money subtotal:money impuesto:money total:money',
  ),
  ReportClientHeader: model('idCliente:int nombreMostrar tipoCliente nit'),
  ReportEquipmentHeader: model(
    'idEquipo:int numeroSerie modelo tipoEquipo marca clienteNombre',
  ),
  Meta: model('page:int pageSize:int total:int totalPages:int'),
};
definitions.InvoiceDetail = {
  ...definitions.Invoice,
  properties: {
    ...definitions.Invoice.properties,
    detalles: array('InvoiceLine'),
    pagos: array('Payment'),
  },
  required: [...definitions.Invoice.required!, 'detalles', 'pagos'],
};
definitions.PurchaseDetail = {
  ...definitions.Purchase,
  properties: {
    ...definitions.Purchase.properties,
    items: array('PurchaseItemRead'),
  },
  required: [...definitions.Purchase.required!, 'items'],
};
definitions.OrderDetail = {
  ...definitions.Order,
  properties: {
    ...definitions.Order.properties,
    historial: array('History'),
    diagnosticos: array('Diagnosis'),
    reparaciones: array('Repair'),
    factura: nullableRef('InvoiceDetail'),
    entrega: nullableRef('Delivery'),
  },
  required: [
    ...definitions.Order.required!,
    'historial',
    'diagnosticos',
    'reparaciones',
    'factura',
    'entrega',
  ],
};
definitions.ReportClient = model('', {
  cliente: ref('ReportClientHeader'),
  ordenes: array('OrderDetail'),
});
definitions.ReportEquipment = model('', {
  equipo: ref('ReportEquipmentHeader'),
  ordenes: array('OrderDetail'),
});
definitions.ReportTrace = model('', {
  orden: ref('Order'),
  historial: array('History'),
  diagnosticos: array('Diagnosis'),
  reparaciones: array('Repair'),
  movimientos: array('Movement'),
  factura: nullableRef('InvoiceDetail'),
  pagos: array('Payment'),
  entrega: nullableRef('Delivery'),
});

function envelope(data: SchemaObject, paged = false): SchemaObject {
  return model('', { data, ...(paged ? { meta: ref('Meta') } : {}) });
}
export function documentResponses(document: OpenAPIObject) {
  document.components ??= {};
  document.components.schemas = {
    ...document.components.schemas,
    ...definitions,
  };
  const outputs: Record<string, SchemaObject> = {};
  for (const [route, name] of [
    ['clientes', 'Client'],
    ['equipos', 'Equipment'],
    ['repuestos', 'Part'],
    ['proveedores', 'Supplier'],
    ['bodegas', 'Warehouse'],
    ['usuarios', 'User'],
    ['ordenes', 'Order'],
    ['compras', 'Purchase'],
    ['facturas', 'Invoice'],
  ]) {
    outputs[`get /${route}`] = envelope(array(name), true);
    const detail = ['Order', 'Purchase', 'Invoice'].includes(name)
      ? `${name}Detail`
      : name;
    outputs[`get /${route}/{id}`] = envelope(ref(detail));
    if (!['ordenes', 'compras', 'facturas'].includes(route)) {
      outputs[`post /${route}`] = envelope(ref(name));
      outputs[`patch /${route}/{id}`] = envelope(ref(name));
    }
  }
  const actions: Record<string, SchemaObject> = {
    'post /auth/login': ref('LoginResult'),
    'get /auth/me': ref('SessionUser'),
    'post /auth/logout': model('message'),
    'get /health': model('status'),
    'get /ready': model('status'),
    'get /dashboard': ref('Dashboard'),
    'get /catalogos': ref('Catalogs'),
    'get /catalogos/{catalogo}': array('Catalog'),
    'post /catalogos/{catalogo}': ref('Catalog'),
    'patch /catalogos/{catalogo}/{id}': ref('Catalog'),
    'post /ordenes': model('idOrden:int numeroOrden estado'),
    'post /ordenes/{id}/diagnostico': model(
      'idDiagnostico:int idOrden:int estadoOrden',
    ),
    'post /ordenes/{id}/reparaciones': model(
      'idReparacion:int idOrden:int estado estadoOrden',
    ),
    'post /ordenes/{id}/estado': model('idOrden:int estado'),
    'post /ordenes/{id}/entrega': model(
      'idEntrega:int idOrden:int estadoOrden',
    ),
    'post /reparaciones/{id}/finalizar': model(
      'idReparacion:int estado estadoOrden',
    ),
    'post /reparaciones/{id}/actividades': model('idActividad:int'),
    'post /reparaciones/{id}/repuestos': model(
      'idRepuestoReparacion:int existenciaResultante:int',
    ),
    'post /compras': model('idCompra:int numeroCompra estado'),
    'post /compras/{id}/recibir': model('idCompra:int estado'),
    'get /inventario': array('Inventory'),
    'get /inventario/movimientos': array('Movement'),
    'post /inventario/ajustes': model(
      'idBodega:int idRepuesto:int existenciaResultante:int',
    ),
    'patch /inventario/{idBodega}/{idRepuesto}/stock-minimo': model(
      'idBodega:int idRepuesto:int stockMinimo:int',
    ),
    'get /ordenes/{id}/resumen-facturacion': model(
      'subtotalManoObra:money subtotalRepuestos:money porcentajeImpuesto:money impuesto:money total:money',
    ),
    'post /ordenes/{id}/factura': model(
      'idFactura:int numeroFactura estado subtotalManoObra:money subtotalRepuestos:money subtotal:money impuesto:money total:money saldo:money',
    ),
    'post /facturas/{id}/pagos': model(
      'idPago:int idFactura:int saldo:money estadoFactura',
    ),
    'post /pagos/{id}/anular': model(
      'idPago:int estado saldo:money estadoFactura',
    ),
  };
  for (const [key, schema] of Object.entries(actions))
    outputs[key] = envelope(
      schema,
      key === 'get /inventario' || key === 'get /inventario/movimientos',
    );
  for (const [slug, name] of [
    ['ordenes-activas', 'ReportActive'],
    ['historial-cliente', 'ReportClient'],
    ['historial-equipo', 'ReportEquipment'],
    ['actividad-tecnico', 'ReportTechnician'],
    ['repuestos-utilizados', 'ReportConsumed'],
    ['inventario', 'ReportInventory'],
    ['bajo-minimo', 'ReportMinimum'],
    ['compras-proveedor', 'ReportPurchases'],
    ['movimientos', 'ReportMovement'],
    ['facturas-saldo', 'ReportInvoices'],
    ['ingresos', 'ReportIncome'],
    ['trazabilidad', 'ReportTrace'],
  ]) {
    const composite = [
      'historial-cliente',
      'historial-equipo',
      'trazabilidad',
    ].includes(slug);
    outputs[`get /reportes/${slug}`] = envelope(
      composite ? ref(name) : array(name),
      !composite,
    );
  }
  const error: SchemaObject = model('requestId', {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {
          type: 'object',
          additionalProperties: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  });
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'patch'] as const) {
      const operation = item[method];
      if (!operation) continue;
      const key = `${method} ${path.replace(/^\/api\/v1/, '')}`;
      const success =
        Object.keys(operation.responses).find((status) =>
          status.startsWith('2'),
        ) ?? '200';
      const exportRoute = key === 'get /reportes/{slug}/exportar';
      const pdfRoute = key === 'get /facturas/{id}/pdf';
      operation.responses[success] = {
        description: 'Operación confirmada.',
        content: exportRoute ? {
          'text/csv': { schema: { type: 'string', format: 'binary' } },
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
            schema: { type: 'string', format: 'binary' },
          },
        } : pdfRoute ? {
          'application/pdf': { schema: { type: 'string', format: 'binary' } },
        } : {
          'application/json': {
            schema: outputs[key] ?? envelope({ type: 'object' }),
          },
        },
      };
      for (const status of ['400', '401', '403', '404', '409', '413', '429', '500', '503'])
        operation.responses[status] = {
          description: 'Error controlado; consultar error.code y requestId.',
          content: { 'application/json': { schema: error } },
        };
      if (method !== 'get')
        operation.description = `${operation.description ?? ''} Requiere Content-Type: application/json y Origin exacto autorizado. No repetir automáticamente si se pierde la respuesta.`;
      if (
        key.startsWith('get /reportes/') &&
        Object.prototype.hasOwnProperty.call(
          reports,
          key.slice('get /reportes/'.length),
        )
      ) {
        const slug = key.split('/').pop()! as keyof typeof reports;
        const allowed = new Set<string>([
          ...reports[slug].keys,
          'page',
          'pageSize',
          'search',
        ]);
        const required =
          slug === 'historial-cliente'
            ? ['idCliente']
            : slug === 'historial-equipo'
              ? ['numeroSerie']
              : slug === 'actividad-tecnico'
                ? ['idTecnico', 'fechaDesde', 'fechaHasta']
                : slug === 'trazabilidad'
                  ? ['idOrden']
                  : [];
        operation.parameters = operation.parameters
          ?.filter((p) => '$ref' in p || allowed.has(p.name))
          .map((p) =>
            '$ref' in p ? p : { ...p, required: required.includes(p.name) },
          );
        operation.description = `${operation.description ?? ''} Fechas civiles inclusivas de Guatemala. Los procedimientos actuales retornan el conjunto completo: la API aplica la paginación antes de responder. Históricos y trazabilidad son un recurso completo, sin recortar sus relaciones.`;
      }
    }
  }
}
