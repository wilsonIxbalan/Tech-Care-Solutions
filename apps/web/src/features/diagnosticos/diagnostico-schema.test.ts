import { describe, expect, it } from 'vitest'
import type { OrderState } from '@/types/api'
import type { DiagnosticoCatalogos, TecnicoDiagnostico } from '@/features/diagnosticos/diagnostico-catalogos'
import { createDiagnosticoSchema } from '@/features/diagnosticos/diagnostico-schema'

const tecnico: TecnicoDiagnostico = {
  idTecnico: 31, nombreCompleto: 'Técnico de prueba', activo: true,
  roles: ['TECNICO'], permisos: ['DIAGNOSTICO_REGISTRAR'],
}
const catalogos = {
  ordenes: [{ idOrden: 21, numeroOrden: 'ORDEN-PRUEBA', estado: 'RECIBIDO' }],
  tecnicos: [tecnico],
} satisfies DiagnosticoCatalogos
const values = { idOrden: '21', idTecnico: '31', descripcion: 'Diagnóstico de prueba', costoManoObraEstimado: '0.00' }

describe('reglas del diagnóstico', () => {
  it('obtiene los campos del formulario sin inventar identificador, fecha ni estado', () => {
    expect(createDiagnosticoSchema(catalogos).parse({
      ...values, descripcion: '  Diagnóstico de prueba  ',
      idDiagnostico: 999, fechaDiagnostico: '2026-10-22T00:00:00Z', estado: 'ACTIVO',
    })).toEqual({ ...values, idOrden: 21, idTecnico: 31 })
  })

  it.each(['RECIBIDO', 'DIAGNOSTICO'] as const)('permite el estado de entrada %s definido por el procedimiento', estado => {
    const data = { ...catalogos, ordenes: [{ ...catalogos.ordenes[0], estado }] }
    expect(createDiagnosticoSchema(data).safeParse(values).success).toBe(true)
  })

  it.each<OrderState>(['ESPERANDO_AUTORIZACION', 'REPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'])('rechaza una orden en %s aunque se fuerce su identificador', estado => {
    const data = { ...catalogos, ordenes: [{ ...catalogos.ordenes[0], estado }] }
    const result = createDiagnosticoSchema(data).safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['idOrden'])
  })

  it.each([
    { reason: 'inactivo', tecnico: { ...tecnico, activo: false } },
    { reason: 'sin rol técnico', tecnico: { ...tecnico, roles: [] } },
    { reason: 'sin permiso', tecnico: { ...tecnico, permisos: [] } },
    { reason: 'administrador sin rol técnico', tecnico: { ...tecnico, roles: ['ADMINISTRADOR'] } },
  ] satisfies { reason: string; tecnico: TecnicoDiagnostico }[])('rechaza un técnico $reason', ({ tecnico: invalidTecnico }) => {
    const result = createDiagnosticoSchema({ ...catalogos, tecnicos: [invalidTecnico] }).safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['idTecnico'])
  })

  it.each(['idOrden', 'idTecnico'] as const)('rechaza %s ajeno al catálogo recibido', field => {
    const result = createDiagnosticoSchema(catalogos).safeParse({ ...values, [field]: '9999' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual([field])
  })

  it('aplica el límite real de 1000 caracteres de la descripción', () => {
    const schema = createDiagnosticoSchema(catalogos)
    expect(schema.safeParse({ ...values, descripcion: 'x'.repeat(1000) }).success).toBe(true)
    const result = schema.safeParse({ ...values, descripcion: 'x'.repeat(1001) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('La descripción debe tener como máximo 1000 caracteres.')
  })
})

describe('costo estimado DECIMAL(12,2) como Money', () => {
  it.each([
    ['0', '0.00'],
    ['12', '12.00'],
    ['12.5', '12.50'],
    ['9999999999.99', '9999999999.99'],
    [' 000012.01 ', '12.01'],
    ['0.01', '0.01'],
    ['00000000000.00', '0.00'],
    ['9999999999.9', '9999999999.90'],
  ])('normaliza %j a %j sin punto flotante', (input, expected) => {
    const result = createDiagnosticoSchema(catalogos).parse({ ...values, costoManoObraEstimado: input })
    expect(result.costoManoObraEstimado).toBe(expected)
    expect(typeof result.costoManoObraEstimado).toBe('string')
  })

  it.each(['-0.01', '10000000000.00', '1.234', '1e3', '1,50', '1,000.00', 'NaN', 'Infinity'])('rechaza %j sin redondearlo ni reinterpretarlo', costoManoObraEstimado => {
    const result = createDiagnosticoSchema(catalogos).safeParse({ ...values, costoManoObraEstimado })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['costoManoObraEstimado'])
  })
})
