import { z } from 'zod'
import type { EquipoCatalogos } from '@/features/equipos/equipo-catalogos'

function catalogId(ids: readonly number[] | undefined, message: string) {
  return z.string().trim()
    .min(1, message)
    .refine(value => value === '' || ids?.some(id => String(id) === value), message)
    .transform(Number)
}

// Restricciones de dbo.Equipo (database/fases/01_tablas.sql).
// La unicidad de la serie y las relaciones deben verificarse en el servidor.
export function createEquipoSchema(catalogos: EquipoCatalogos) {
  return z.object({
    idCliente: catalogId(catalogos.clientes?.map(cliente => cliente.idCliente), 'Selecciona un cliente propietario del catálogo disponible.'),
    idTipoEquipo: catalogId(catalogos.tiposEquipo?.map(tipo => tipo.idTipoEquipo), 'Selecciona un tipo de equipo del catálogo disponible.'),
    idMarca: catalogId(catalogos.marcas?.map(marca => marca.idMarca), 'Selecciona una marca del catálogo disponible.'),
    modelo: z.string().trim()
      .min(1, 'Escribe el modelo.')
      .max(80, 'El modelo debe tener como máximo 80 caracteres.'),
    numeroSerie: z.string().trim()
      .min(1, 'Escribe el número de serie.')
      .max(60, 'El número de serie debe tener como máximo 60 caracteres.'),
    // EquipmentInput exige texto no vacío y no admite null.
    descripcion: z.string().trim()
      .min(1, 'Escribe la descripción del equipo.')
      .max(300, 'La descripción debe tener como máximo 300 caracteres.'),
  })
}

export type EquipoFormInput = z.input<ReturnType<typeof createEquipoSchema>>
export type EquipoFormValues = z.output<ReturnType<typeof createEquipoSchema>>
