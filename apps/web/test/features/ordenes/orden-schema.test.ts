import { describe, expect, it } from 'vitest'
import type { OrdenCatalogos } from '@/features/ordenes/orden-catalogos'
import { createOrdenSchema } from '@/features/ordenes/orden-schema'

const catalogos = {
  clientes: [
    { idCliente: 11, nombreMostrar: 'Cliente A de prueba', estado: 'ACTIVO' },
    { idCliente: 12, nombreMostrar: 'Cliente B de prueba', estado: 'ACTIVO' },
    { idCliente: 13, nombreMostrar: 'Cliente inactivo de prueba', estado: 'INACTIVO' },
  ],
  equipos: [
    { idEquipo: 21, idCliente: 11, modelo: 'Modelo A de prueba', numeroSerie: 'SERIE-A-PRUEBA', estado: 'ACTIVO' },
    { idEquipo: 22, idCliente: 12, modelo: 'Modelo B de prueba', numeroSerie: 'SERIE-B-PRUEBA', estado: 'ACTIVO' },
    { idEquipo: 23, idCliente: 11, modelo: 'Modelo inactivo de prueba', numeroSerie: 'SERIE-INACTIVA-PRUEBA', estado: 'INACTIVO' },
    { idEquipo: 24, idCliente: 13, modelo: 'Modelo C de prueba', numeroSerie: 'SERIE-C-PRUEBA', estado: 'ACTIVO' },
  ],
  prioridades: [{ idPrioridad: 7, nombre: 'Prioridad de prueba' }],
} satisfies OrdenCatalogos

const values = {
  idCliente: '11', idEquipo: '21', idPrioridad: '7',
  problemaReportado: 'No enciende', fechaEstimada: '', observaciones: '',
}

describe('validación de recepción de órdenes', () => {
  it('recorta texto, mantiene la fecha civil y excluye datos asignados por el servidor', () => {
    expect(createOrdenSchema(catalogos).parse({
      ...values, problemaReportado: '  No enciende  ', fechaEstimada: '2026-10-31', observaciones: '  Revisar cargador  ',
      numeroOrden: 'NO-GENERAR', idUsuarioRecepcion: 999, fechaIngreso: '2026-10-22T00:00:00Z', estado: 'RECIBIDO',
    })).toEqual({
      ...values, idCliente: 11, idEquipo: 21, idPrioridad: 7, fechaEstimada: '2026-10-31', observaciones: 'Revisar cargador',
    })
  })

  it('rechaza un equipo de otro cliente aunque ambos estén activos y existan en los catálogos', () => {
    const result = createOrdenSchema(catalogos).safeParse({ ...values, idEquipo: '22' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        path: ['idEquipo'], message: 'El equipo seleccionado no pertenece al cliente.',
      }))
    }
  })

  it.each(['idCliente', 'idEquipo', 'idPrioridad'] as const)('rechaza %s ajeno al catálogo recibido', field => {
    const result = createOrdenSchema(catalogos).safeParse({ ...values, [field]: '9999' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field] }))
  })

  it('rechaza un cliente inactivo aunque el equipo le pertenezca', () => {
    const result = createOrdenSchema(catalogos).safeParse({ ...values, idCliente: '13', idEquipo: '24' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['idCliente'] }))
  })

  it.each(['INACTIVO', 'BAJA'] as const)('rechaza un equipo en estado %s', estado => {
    const data = { ...catalogos, equipos: catalogos.equipos.map(equipo => equipo.idEquipo === 21 ? { ...equipo, estado } : equipo) }
    const result = createOrdenSchema(data).safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['idEquipo'] }))
  })

  it('no valida identificadores sin catálogos', () => {
    const result = createOrdenSchema({}).safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map(issue => issue.path[0])).toEqual(['idCliente', 'idEquipo', 'idPrioridad'])
  })

  it.each([['problemaReportado', 1000], ['observaciones', 500]] as const)('respeta el límite SQL de %s', (field, limit) => {
    const schema = createOrdenSchema(catalogos)
    expect(schema.safeParse({ ...values, [field]: 'x'.repeat(limit) }).success).toBe(true)
    const result = schema.safeParse({ ...values, [field]: 'x'.repeat(limit + 1) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field] }))
  })

  it.each(['2026-02-30', '2026-2-03', '2026-10-31T00:00:00Z', '0000-01-01'])('rechaza una fecha civil inválida: %s', fechaEstimada => {
    const result = createOrdenSchema(catalogos).safeParse({ ...values, fechaEstimada })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['fechaEstimada'] }))
  })

  it.each(['', '2000-02-29', '2026-10-31', '2099-12-31'])('conserva la fecha %j sin inventar la fecha real de ingreso', fechaEstimada => {
    const result = createOrdenSchema(catalogos).parse({ ...values, fechaEstimada, observaciones: '   ' })
    expect(result.fechaEstimada).toBe(fechaEstimada)
    expect(result.observaciones).toBe('')
  })
})
