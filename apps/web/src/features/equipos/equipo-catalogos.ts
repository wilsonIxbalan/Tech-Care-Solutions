import type { ClienteDto, EquipoDto } from '@/types/domain'

// Opciones recibidas por la interfaz; no son contratos HTTP.
// undefined: pendiente de conexión. []: catálogo recibido sin opciones.
export interface EquipoCatalogos {
  clientes?: readonly Pick<ClienteDto, 'idCliente' | 'nombreMostrar'>[]
  tiposEquipo?: readonly { idTipoEquipo: EquipoDto['idTipoEquipo']; nombre: string }[]
  marcas?: readonly { idMarca: EquipoDto['idMarca']; nombre: string }[]
}
