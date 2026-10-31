import type { DiagnosticoDto, OrdenResumenDto } from '@/types/domain'
import type { RoleCode } from '@/types/api'

// Datos recibidos por el formulario, no contratos HTTP ni una sesión simulada.
// Los roles/permisos deben ser efectivos (roles vigentes), según las funciones SQL.
export interface TecnicoDiagnostico {
  idTecnico: DiagnosticoDto['idTecnico']
  nombreCompleto: string
  activo: boolean
  roles: readonly RoleCode[]
  permisos: readonly string[]
}

export interface DiagnosticoCatalogos {
  // undefined: conexión pendiente; []: catálogo recibido sin registros.
  ordenes?: readonly Pick<OrdenResumenDto, 'idOrden' | 'numeroOrden' | 'estado'>[]
  tecnicos?: readonly TecnicoDiagnostico[]
}

// sp_RegistrarDiagnostico: errores 50301 y 50302 (fase 07).
export function permiteDiagnostico(orden: { estado: OrdenResumenDto['estado'] }) {
  return orden.estado === 'RECIBIDO' || orden.estado === 'DIAGNOSTICO'
}

// Elegibilidad según datos recibidos. No acredita permisos del usuario ejecutor.
export function esTecnicoElegible(tecnico: TecnicoDiagnostico) {
  return tecnico.activo && tecnico.roles.includes('TECNICO') && tecnico.permisos.includes('DIAGNOSTICO_REGISTRAR')
}
