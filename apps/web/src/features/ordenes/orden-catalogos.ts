import type { ClienteDto, EquipoDto, OrdenResumenDto } from '@/types/domain'

// Opciones recibidas por el módulo, no contratos HTTP ni catálogos simulados.
// undefined indica conexión pendiente; [] indica datos recibidos sin opciones.
export interface OrdenCatalogos {
  clientes?: readonly Pick<ClienteDto, 'idCliente' | 'nombreMostrar' | 'estado'>[]
  equipos?: readonly Pick<EquipoDto, 'idEquipo' | 'idCliente' | 'modelo' | 'numeroSerie' | 'estado'>[]
  prioridades?: readonly { idPrioridad: OrdenResumenDto['idPrioridad']; nombre: string }[]
}
