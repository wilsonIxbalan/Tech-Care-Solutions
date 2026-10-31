/** Mapa operativo de pantallas; la autorizacion real corresponde al backend. */
export const businessModules = [
  { path: '/clientes', title: 'Clientes', description: 'Personas individuales y empresas; NIT, contacto y estado.', workflow: 'Cliente → equipos → historial de órdenes.' },
  { path: '/equipos', title: 'Equipos', description: 'Tipo, marca, modelo, serie y propietario del equipo.', workflow: 'Consultar el historial completo por número de serie.' },
  { path: '/ordenes', title: 'Órdenes de servicio', description: 'Recepción, prioridad, fechas y seguimiento de estados.', workflow: 'Recibido → diagnóstico → autorización → reparación → listo → entrega.' },
  { path: '/diagnosticos', title: 'Diagnósticos y reparaciones', description: 'Diagnóstico previo, actividades, mano de obra y consumo de repuestos.', workflow: 'Registrar el trabajo técnico y los repuestos utilizados.' },
  { path: '/facturacion', title: 'Facturación y pagos', description: 'Factura por orden, pagos parciales, métodos y saldo.', workflow: 'Consultar el saldo vigente antes de registrar un pago o entregar.' },
  { path: '/entregas', title: 'Entregas y cierre', description: 'Responsable de entrega, receptor, fecha y observaciones.', workflow: 'Cerrar únicamente con servicio terminado y reglas financieras satisfechas.' },
  { path: '/repuestos', title: 'Repuestos', description: 'Catálogo, categorías, código y precios de referencia.', workflow: 'Administrar catálogo sin modificar existencias desde esta pantalla.' },
  { path: '/inventario', title: 'Inventario y movimientos', description: 'Existencias y mínimos por bodega, entradas y salidas con origen.', workflow: 'Consultar stock; los cambios provienen de procesos controlados.' },
  { path: '/proveedores', title: 'Proveedores', description: 'Datos y contacto de proveedores.', workflow: 'Proveedor → compra → recepción en bodega.' },
  { path: '/compras', title: 'Compras', description: 'Encabezado, detalle, costos históricos y recepción.', workflow: 'Registrar la compra y confirmar su recepción completa en bodega.' },
  { path: '/reportes', title: 'Reportes', description: 'Consultas de servicio, inventario y finanzas.', workflow: 'Consultar y exportar resultados según los filtros y el acceso de tu perfil.' },
  { path: '/usuarios', title: 'Usuarios y roles', description: 'Administración de usuarios y asignación formal de roles.', workflow: 'Administrador, Recepción, Técnico, Bodega y Caja.' },
] as const
