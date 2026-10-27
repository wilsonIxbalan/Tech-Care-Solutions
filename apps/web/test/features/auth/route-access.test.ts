import { describe, expect, it } from 'vitest'
import { canAccessPath } from '@/features/auth/route-access'
import { adminUser } from '../../support/session'

describe('permisos de rutas privadas', () => {
  it('no interpreta ADMINISTRADOR como un permiso implícito', () => {
    expect(canAccessPath({ ...adminUser, permisos: [] }, '/compras')).toBe(false)
    expect(canAccessPath({ ...adminUser, permisos: [] }, '/usuarios')).toBe(true)
    expect(canAccessPath({ ...adminUser, roles: ['CAJA'] }, '/usuarios')).toBe(false)
    expect(canAccessPath(null, '/dashboard')).toBe(false)
  })
  it.each([
    ['/clientes', 'CLIENTES_GESTIONAR'], ['/equipos', 'EQUIPOS_GESTIONAR'], ['/ordenes', 'ORDENES_CREAR'],
    ['/diagnosticos', 'REPARACION_GESTIONAR'], ['/repuestos', 'REPUESTOS_CONSUMIR'], ['/inventario', 'INVENTARIO_GESTIONAR'],
    ['/proveedores', 'PROVEEDORES_GESTIONAR'], ['/compras', 'COMPRAS_GESTIONAR'], ['/facturacion', 'PAGOS_REGISTRAR'],
    ['/entregas', 'ENTREGAR_ORDEN'], ['/reportes', 'REPORTES_VER'],
  ])('requiere un permiso efectivo para %s y sus rutas descendientes', (path, permission) => {
    expect(canAccessPath({ ...adminUser, roles: ['TECNICO'], permisos: [] }, path)).toBe(false)
    expect(canAccessPath({ ...adminUser, roles: ['TECNICO'], permisos: [permission] }, path)).toBe(true)
    expect(canAccessPath({ ...adminUser, roles: ['TECNICO'], permisos: [permission] }, `${path}/1`)).toBe(true)
  })
  it('permite la bienvenida sin habilitar consultas protegidas', () => {
    const limited = { ...adminUser, roles: ['TECNICO'] as const, permisos: [] }
    expect(canAccessPath({ ...limited, roles: [...limited.roles] }, '/dashboard')).toBe(true)
  })
})
