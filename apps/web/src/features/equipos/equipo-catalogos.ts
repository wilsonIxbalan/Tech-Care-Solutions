import type { ClienteDto, EquipoDto } from '@/types/domain'

// Opciones para validar la selección; clientes incluye la selección persistida.
export interface EquipoCatalogos {
  clientes?: readonly Pick<ClienteDto, 'idCliente' | 'nombreMostrar'>[]
  tiposEquipo?: readonly { idTipoEquipo: EquipoDto['idTipoEquipo']; nombre: string }[]
  marcas?: readonly { idMarca: EquipoDto['idMarca']; nombre: string }[]
}
