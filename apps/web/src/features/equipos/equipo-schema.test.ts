import { describe, expect, it } from 'vitest'
import { createEquipoSchema } from '@/features/equipos/equipo-schema'
import type { EquipoCatalogos } from '@/features/equipos/equipo-catalogos'

const catalogos = {
  clientes: [{ idCliente: 11, nombreMostrar: 'Cliente de prueba' }],
  tiposEquipo: [{ idTipoEquipo: 7, nombre: 'Tipo de prueba' }],
  marcas: [{ idMarca: 23, nombre: 'Marca de prueba' }],
} satisfies EquipoCatalogos

const values = {
  idCliente: '11', idTipoEquipo: '7', idMarca: '23',
  modelo: 'Modelo de prueba', numeroSerie: 'SERIE-PRUEBA', descripcion: '',
}

describe('validación de Equipos', () => {
  it('valida selecciones recibidas, recorta texto y obtiene identificadores numéricos', () => {
    expect(createEquipoSchema(catalogos).parse({
      ...values, modelo: '  Modelo de prueba  ', numeroSerie: '  SERIE-PRUEBA  ', descripcion: '  Descripción de prueba  ',
    })).toEqual({
      ...values, idCliente: 11, idTipoEquipo: 7, idMarca: 23, descripcion: 'Descripción de prueba',
    })
  })

  it.each(['idCliente', 'idTipoEquipo', 'idMarca'] as const)('rechaza %s ajeno al catálogo recibido', field => {
    const result = createEquipoSchema(catalogos).safeParse({ ...values, [field]: '9999' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual([field])
  })

  it('rechaza identificadores aunque tengan formato válido si no hay catálogos', () => {
    const result = createEquipoSchema({}).safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path[0])).toEqual(['idCliente', 'idTipoEquipo', 'idMarca'])
    }
  })

  it.each([['modelo', 80], ['numeroSerie', 60], ['descripcion', 300]] as const)('respeta el límite existente de %s', (field, limit) => {
    const schema = createEquipoSchema(catalogos)
    expect(schema.safeParse({ ...values, [field]: 'x'.repeat(limit) }).success).toBe(true)
    const result = schema.safeParse({ ...values, [field]: 'x'.repeat(limit + 1) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual([field])
  })

  it('permite la descripción vacía como SQL, sin producir null ni campos administrados por el servidor', () => {
    expect(createEquipoSchema(catalogos).parse({
      ...values, descripcion: '   ', idEquipo: 100, estado: 'ACTIVO', fechaRegistro: '2026-10-22',
    })).toEqual({ ...values, idCliente: 11, idTipoEquipo: 7, idMarca: 23 })
  })
})
