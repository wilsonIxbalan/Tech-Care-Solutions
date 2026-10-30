import { describe, expect, it } from 'vitest'
import sql from '../../../../../database/fases/09_reportes.sql?raw'
import { reportDefinitions } from '@/features/reportes/reportes-model'
import { createReportSchema } from '@/features/reportes/reporte-schema'
import { formatReportValue } from '@/features/reportes/reporte-format'

// Se contrasta con la fuente SQL independiente; no se ejecuta SQL ni se copia
// una segunda lista de metadatos que podría repetir el mismo error del frontend.
const procedures = sql.split(/CREATE OR ALTER PROCEDURE dbo\./i).slice(1)

describe('filtros y proyecciones de los doce reportes SQL', () => {
  it('cubre cada procedimiento de fase 09 una sola vez', () => {
    expect(new Set(reportDefinitions.map(r => r.procedure)).size).toBe(12)
    expect(reportDefinitions.map(r => r.procedure).sort()).toEqual(procedures.map(body => body.match(/^\w+/)![0]).sort())
  })
  it.each(reportDefinitions)('$procedure conserva sus parámetros y columnas por conjunto', report => {
    const body = procedures.find(body => body.startsWith(report.procedure))!
    const header = body.split(/\r?\nAS\b/i)[0]
    const parameters = [...header.matchAll(/@(\w+)\s+/g)].map(match => match[1])
    const internal = ['Page', 'PageSize', 'Search', 'MaxRows']
    expect(report.filters.map(f => f.key)).toEqual(parameters.filter(name => !internal.includes(name)))
    const complete = ['historial-cliente', 'historial-equipo', 'trazabilidad'].includes(report.id)
    expect(parameters.filter(name => internal.includes(name))).toEqual(complete ? ['MaxRows'] : internal)
    // Solo SELECT publicos despues de validar el limite; INTO # temporales,
    // subconsultas de conteo y metadata final no son conjuntos del reporte.
    const projection = body.slice(body.indexOf('THROW 51710'))
    const sets = [...projection.matchAll(/\bSELECT\s+([\w.,\s]+?)\s+FROM\s+#\w+\b/gi)].map(match => match[1].split(',').map(column => column.trim().match(/(\w+)$/)![1]))
    expect(report.sets.map(set => [...set.columns])).toEqual(sets)
  })
  it('no trata un filtro booleano vacío como Todos ni un decimal numérico como Money exacto', () => {
    const schema = createReportSchema(reportDefinitions.find(r => r.id === 'facturas-saldo')!, {})
    expect(schema.safeParse({ IdCliente: '', ConSaldo: '', Estado: '', Desde: '', HastaExclusiva: '' }).success).toBe(false)
    expect(formatReportValue('Total', '99999999999999999999.99')).toBe('Q 99,999,999,999,999,999,999.99')
    expect(formatReportValue('Total', 10.1)).toBe('Importe no verificable')
    expect(formatReportValue('FechaEntrega', null)).toBe('—')
    expect(formatReportValue('IdDiagnostico', undefined)).toBe('Campo no recibido')
    expect(formatReportValue('Cantidad', 0)).toBe('0')
    expect(formatReportValue('FechaEstimada', '2026-10-22')).toBe('22/10/2026')
  })
})
