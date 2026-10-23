// Describe el alcance de interfaz; no equivale a disponibilidad del proceso empresarial.
export const partialFrontend: Readonly<Record<string, string>> = {
  '/clientes': 'Alta preparada. Listado, filtros y edición todavía requieren interfaz.',
  '/equipos': 'Alta y entrada de serie preparadas. Listado y vista del historial todavía requieren interfaz.',
  '/ordenes': 'Recepción preparada. Listado y detalle con historial todavía requieren interfaz.',
  '/diagnosticos': 'Diagnóstico e inicio de reparación preparados. Listados, actividades y consumo todavía requieren interfaz; los comandos necesitan una reparación persistida.',
  '/facturacion': 'Datos fiscales, detalle y pago preparados. La interfaz de anulación todavía no está preparada.',
  '/usuarios': 'Perfil y asignación preparados. Edición y retirada de roles todavía requieren interfaz; el alta segura debe acordarse.',
}
