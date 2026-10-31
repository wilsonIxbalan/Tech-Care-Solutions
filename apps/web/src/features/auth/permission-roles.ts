import type { RoleCode, SessionUser } from '@/types/api'
import { roleCodes, roleLabels } from './roles'

/** Copia informativa de database/fases/06_catalogos.sql; el backend sigue autorizando. */
export const permissionLabels = {
  CLIENTES_GESTIONAR: 'Gestionar clientes',
  EQUIPOS_GESTIONAR: 'Gestionar equipos',
  ORDENES_CREAR: 'Registrar órdenes de servicio',
  DIAGNOSTICO_REGISTRAR: 'Registrar diagnósticos',
  REPARACION_GESTIONAR: 'Gestionar reparaciones',
  REPUESTOS_CONSUMIR: 'Consumir repuestos en reparaciones',
  INVENTARIO_GESTIONAR: 'Gestionar inventario y ajustes',
  COMPRAS_GESTIONAR: 'Registrar y recibir compras',
  PROVEEDORES_GESTIONAR: 'Gestionar proveedores',
  FACTURAR: 'Emitir facturas',
  PAGOS_REGISTRAR: 'Registrar y anular pagos',
  ENTREGAR_ORDEN: 'Entregar órdenes',
  REPORTES_VER: 'Consultar reportes e indicadores',
  USUARIOS_GESTIONAR: 'Gestionar usuarios y roles',
} as const

export type PermissionCode = keyof typeof permissionLabels
export const permissionCodes = Object.keys(permissionLabels) as PermissionCode[]

export const rolePermissions: Record<RoleCode, readonly PermissionCode[]> = {
  ADMINISTRADOR: permissionCodes,
  RECEPCION: ['CLIENTES_GESTIONAR', 'EQUIPOS_GESTIONAR', 'ORDENES_CREAR', 'ENTREGAR_ORDEN', 'REPORTES_VER'],
  TECNICO: ['DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'REPUESTOS_CONSUMIR', 'REPORTES_VER'],
  BODEGA: ['INVENTARIO_GESTIONAR', 'COMPRAS_GESTIONAR', 'PROVEEDORES_GESTIONAR', 'REPORTES_VER'],
  CAJA: ['FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER'],
}

/** Roles que, según el catálogo, tienen el permiso. */
export function rolesWith(permission: PermissionCode): RoleCode[] {
  return roleCodes.filter(role => rolePermissions[role].includes(permission))
}

export function roleNamesWith(permission: PermissionCode): string {
  return rolesWith(permission).map(role => roleLabels[role]).join(', ')
}

/** La sesión trae los permisos efectivos del usuario; se usan antes que la matriz. */
export function hasPermission(user: SessionUser | null, permission: PermissionCode): boolean {
  return user?.permisos.includes(permission) ?? false
}
