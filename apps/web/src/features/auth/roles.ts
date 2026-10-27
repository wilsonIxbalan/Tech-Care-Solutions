import type { RoleCode } from '@/types/api'

export const roleLabels: Record<RoleCode, string> = {
  ADMINISTRADOR: 'Administrador', RECEPCION: 'Recepción', TECNICO: 'Técnico', BODEGA: 'Bodega', CAJA: 'Caja',
}
export const roleCodes = ['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'BODEGA', 'CAJA'] as const
export function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase()
}
