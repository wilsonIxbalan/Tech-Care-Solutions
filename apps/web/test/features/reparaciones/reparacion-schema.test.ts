import { describe, expect, it } from 'vitest'
import type { OrderState } from '@/types/api'
import type { ReparacionCatalogos, TecnicoReparacion } from '@/features/reparaciones/reparacion-catalogos'
import { createReparacionSchema } from '@/features/reparaciones/reparacion-schema'

const tecnico: TecnicoReparacion = {
  idTecnico: 33, nombreCompleto: 'Responsable de reparación de prueba', activo: true,
  roles: ['TECNICO'], permisos: ['REPARACION_GESTIONAR'],
}
const catalogos = {
  ordenes: [
    { idOrden: 21, numeroOrden: 'ORDEN-A-PRUEBA', estado: 'ESPERANDO_AUTORIZACION' },
    { idOrden: 22, numeroOrden: 'ORDEN-B-PRUEBA', estado: 'REPARACION' },
  ],
  diagnosticos: [
    { idDiagnostico: 41, idOrden: 21, idTecnico: 31, descripcion: 'Diagnóstico A de prueba', estado: 'ACTIVO' },
    { idDiagnostico: 42, idOrden: 22, idTecnico: 31, descripcion: 'Diagnóstico B de prueba', estado: 'ACTIVO' },
    { idDiagnostico: 43, idOrden: 21, idTecnico: 31, descripcion: 'Diagnóstico anulado de prueba', estado: 'ANULADO' },
  ],
  tecnicos: [tecnico],
} satisfies ReparacionCatalogos
const values = { idOrden: '21', idDiagnostico: '41', idTecnico: '33', descripcion: 'Trabajo de prueba', costoManoObra: '0' }

describe('requisitos para preparar una reparación', () => {
  it('acepta un responsable distinto al del diagnóstico, costo cero y excluye datos nuevos del servidor', () => {
    expect(createReparacionSchema(catalogos).parse({
      ...values, descripcion: '  Trabajo de prueba  ', idReparacion: 99,
      estado: 'EN_PROCESO', fechaInicio: '2026-10-22T00:00:00Z', fechaFin: null,
    })).toEqual({ ...values, idOrden: 21, idDiagnostico: 41, idTecnico: 33, costoManoObra: '0.00' })
  })

  it('rechaza un diagnóstico activo de otra orden incluso si ambos identificadores existen', () => {
    const result = createReparacionSchema(catalogos).safeParse({ ...values, idDiagnostico: '42' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({
      path: ['idDiagnostico'], message: 'El diagnóstico seleccionado no pertenece a la orden.',
    }))
  })

  it.each(['43', '9999'])('rechaza diagnóstico anulado o inexistente: %s', idDiagnostico => {
    const result = createReparacionSchema(catalogos).safeParse({ ...values, idDiagnostico })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['idDiagnostico'])
  })

  it.each(['ESPERANDO_AUTORIZACION', 'REPARACION'] as const)('admite el estado de inicio %s sin exigir una reparación única', estado => {
    const data = { ...catalogos, ordenes: [{ ...catalogos.ordenes[0], estado }] }
    expect(createReparacionSchema(data).safeParse(values).success).toBe(true)
  })

  it.each<OrderState>(['RECIBIDO', 'DIAGNOSTICO', 'LISTO', 'ENTREGADO', 'CANCELADO'])('rechaza una orden en %s aunque tenga diagnóstico activo', estado => {
    const data = { ...catalogos, ordenes: [{ ...catalogos.ordenes[0], estado }] }
    const result = createReparacionSchema(data).safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['idOrden'])
  })

  it.each([
    { reason: 'inactivo', tecnico: { ...tecnico, activo: false } },
    { reason: 'sin rol técnico', tecnico: { ...tecnico, roles: [] } },
    { reason: 'con permiso de diagnóstico pero sin permiso de reparación', tecnico: { ...tecnico, permisos: ['DIAGNOSTICO_REGISTRAR'] } },
  ] satisfies { reason: string; tecnico: TecnicoReparacion }[])('rechaza un técnico $reason', ({ tecnico: invalidTecnico }) => {
    const result = createReparacionSchema({ ...catalogos, tecnicos: [invalidTecnico] }).safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['idTecnico'])
  })

  it('no da por cumplido el diagnóstico previo si no se recibió su catálogo', () => {
    const result = createReparacionSchema({ ...catalogos, diagnosticos: undefined }).safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['idDiagnostico'])
  })

  it('respeta el límite real de la descripción', () => {
    const schema = createReparacionSchema(catalogos)
    expect(schema.safeParse({ ...values, descripcion: 'x'.repeat(1000) }).success).toBe(true)
    expect(schema.safeParse({ ...values, descripcion: 'x'.repeat(1001) }).success).toBe(false)
  })
})
