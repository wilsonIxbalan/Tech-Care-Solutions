import type { DiagnosticoDto, OrdenResumenDto, ReparacionDto } from '@/types/domain'
import type { RoleCode } from '@/types/api'

// Modelos locales para datos recibidos; no son contratos HTTP ni una sesión.
export interface TecnicoReparacion {
  idTecnico: ReparacionDto['idTecnico']
  nombreCompleto: string
  activo: boolean
  roles: readonly RoleCode[]
  permisos: readonly string[]
}

export interface ReparacionCatalogos {
  // undefined: pendiente de conexión; []: catálogo recibido sin registros.
  ordenes?: readonly Pick<OrdenResumenDto, 'idOrden' | 'numeroOrden' | 'estado'>[]
  diagnosticos?: readonly Pick<DiagnosticoDto, 'idDiagnostico' | 'idOrden' | 'idTecnico' | 'descripcion' | 'estado'>[]
  tecnicos?: readonly TecnicoReparacion[]
}

// sp_IniciarReparacion, fase 07 (50401/50402). Sin restricciones de asignación
// entre el técnico del diagnóstico y el de la reparación: SQL no exige igualdad.
export function permiteIniciarReparacion(orden: { estado: OrdenResumenDto['estado'] }) {
  return orden.estado === 'ESPERANDO_AUTORIZACION' || orden.estado === 'REPARACION'
}

// Solo elegibilidad según el catálogo. La autorización del ejecutor es del servidor.
export function esTecnicoElegibleParaReparacion(tecnico: TecnicoReparacion) {
  return tecnico.activo && tecnico.roles.includes('TECNICO') && tecnico.permisos.includes('REPARACION_GESTIONAR')
}
