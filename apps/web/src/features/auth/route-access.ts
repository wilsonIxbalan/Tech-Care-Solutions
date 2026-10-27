import type { RoleCode, SessionUser } from '@/types/api'

interface RouteAccess { permissions?: readonly string[]; roles?: readonly RoleCode[] }

// Permission alternatives mirror the API's read endpoints; role restrictions are additional.
// The server still authorizes every request and every write operation.
const routes: Record<string, RouteAccess> = {
  '/clientes': { permissions: ['CLIENTES_GESTIONAR', 'ORDENES_CREAR', 'DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER'] },
  '/equipos': { permissions: ['EQUIPOS_GESTIONAR', 'ORDENES_CREAR', 'DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'FACTURAR', 'ENTREGAR_ORDEN', 'REPORTES_VER'] },
  '/ordenes': { permissions: ['ORDENES_CREAR', 'DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'REPUESTOS_CONSUMIR', 'FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER'] },
  '/diagnosticos': { permissions: ['DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'REPUESTOS_CONSUMIR', 'REPORTES_VER'] },
  '/repuestos': { permissions: ['INVENTARIO_GESTIONAR', 'REPUESTOS_CONSUMIR', 'COMPRAS_GESTIONAR', 'REPORTES_VER'] },
  '/inventario': { permissions: ['INVENTARIO_GESTIONAR', 'REPUESTOS_CONSUMIR', 'COMPRAS_GESTIONAR', 'REPORTES_VER'] },
  '/proveedores': { permissions: ['PROVEEDORES_GESTIONAR', 'COMPRAS_GESTIONAR', 'REPORTES_VER'] },
  '/compras': { permissions: ['COMPRAS_GESTIONAR'] },
  '/facturacion': { permissions: ['FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER'] },
  '/entregas': { permissions: ['ENTREGAR_ORDEN'] },
  '/reportes': { permissions: ['REPORTES_VER'] },
  '/usuarios': { roles: ['ADMINISTRADOR'] },
}

export function canAccessPath(user: SessionUser | null, pathname: string) {
  if (!user) return false
  const access = routes[`/${pathname.split('/').filter(Boolean)[0] ?? ''}`]
  if (!access) return true // Welcome, dev kit and not-found screens have no protected data.
  return (!access.permissions || access.permissions.some(permission => user.permisos.includes(permission)))
    && (!access.roles || access.roles.some(role => user.roles.includes(role)))
}
