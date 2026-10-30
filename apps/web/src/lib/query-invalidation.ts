import type { QueryClient } from '@tanstack/react-query'

// Include inactive queries so reopening selectors fetches current master data.
const catalogs = ['catalogos', 'reportes-lookup', 'reportes-catalogos', 'abastecimiento-catalogos', 'facturacion-catalogos']
const groups = {
  service: ['ordenes', 'inventario', 'inventario/movimientos', 'repuestos', 'dashboard', 'facturas', 'facturacion-ordenes', 'facturacion-resumen', 'reportes', 'reportes-lookup'],
  billing: ['facturas', 'ordenes', 'dashboard', 'facturacion-ordenes', 'facturacion-resumen', 'reportes'],
  supply: ['proveedores', 'repuestos', 'bodegas', 'compras', 'inventario', 'inventario/movimientos', 'dashboard', 'reportes', ...catalogs],
  customers: ['clientes', 'equipos', 'dashboard', 'reportes', ...catalogs],
  equipment: ['equipos', 'clientes', 'dashboard', 'reportes', ...catalogs],
  users: ['usuarios', 'ordenes', 'session', ...catalogs],
  warehouses: ['bodegas', 'inventario', 'compras', ...catalogs],
} as const

export function invalidateRelatedQueries(client: QueryClient, group: keyof typeof groups) {
  return Promise.all(groups[group].map(key => client.invalidateQueries({ queryKey: [key] })))
}
