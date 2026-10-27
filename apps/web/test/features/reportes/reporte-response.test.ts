import { describe, expect, it } from 'vitest'
import { parseReportResponse } from '@/features/reportes/reporte-response'
import { reportDefinitions } from '@/features/reportes/reportes-model'

describe('contrato JSON de reportes', () => {
  it.each([null, {}, 'texto', [null], [1]])('rechaza respuestas tabulares inválidas (%j)', data => {
    expect(() => parseReportResponse(reportDefinitions[0], { data })).toThrow('no cumple el contrato')
  })
  it('no convierte objetos anidados inesperados en celdas [object Object]', () => {
    expect(() => parseReportResponse(reportDefinitions[0], { data: [{ numeroOrden: { text: 'orden' } }] })).toThrow('no cumple el contrato')
  })
  it('no presenta una trazabilidad incompleta como éxito', () => {
    expect(() => parseReportResponse(reportDefinitions.find(report => report.id === 'trazabilidad')!, { data: { orden: { idOrden: 1 } } })).toThrow('no cumple el contrato')
  })
  it('no presenta un historial sin órdenes recibidas como un historial vacío', () => {
    expect(() => parseReportResponse(reportDefinitions.find(report => report.id === 'historial-cliente')!, { data: { cliente: { idCliente: 1 } } })).toThrow('no cumple el contrato')
  })
  it('preserva nulos y ceros, sin completar campos omitidos con datos inventados', () => {
    const result = parseReportResponse(reportDefinitions[0], { data: [{ idOrden: 1, idTecnico: null, total: '0.00' }] })
    expect(result.sections[0].rows[0].idTecnico).toBeNull()
    expect(result.sections[0].rows[0].numeroOrden).toBeUndefined()
  })
})
