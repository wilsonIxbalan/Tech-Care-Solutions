import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportesPage } from './reportes-page'
import { createReportSchema } from './reporte-schema'
import { reportDefinitions } from './reportes-model'

describe('reportes preparados', () => {
  it('ofrece los doce y cambia filtros sin conservar campos de otro reporte', () => {
    render(<ReportesPage />)
    const selector = screen.getByLabelText('Reporte *')
    expect(within(selector).getAllByRole('option')).toHaveLength(13)
    fireEvent.change(selector, { target: { value: 'historial-equipo' } })
    expect(screen.getByLabelText('Número de serie *')).toBeVisible()
    expect(screen.queryByLabelText('Desde (Guatemala)')).not.toBeInTheDocument()
    fireEvent.change(selector, { target: { value: 'actividad-tecnico' } })
    expect(screen.queryByLabelText('Número de serie *')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
  })
  it('exige técnico, fechas válidas e intervalo exclusivo, y rechaza selecciones desconocidas', () => {
    const schema = createReportSchema(reportDefinitions.find(r => r.id === 'actividad-tecnico')!, { tecnicos: [{ value: '2', label: 'Técnico de prueba' }] })
    const valid = { IdTecnico: '2', Desde: '2026-10-21', HastaExclusiva: '2026-10-22' }
    expect(schema.safeParse(valid).success).toBe(true)
    for (const patch of [{ IdTecnico: '3' }, { Desde: '' }, { HastaExclusiva: '2026-10-21' }, { Desde: '2026-02-30' }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
  it('conserva filas opcionales, ceros y nulos, y separa cabecera del historial', () => {
    render(<ReportesPage resultados={{ 'historial-cliente': {
      cliente: { status: 'success', data: [{ IdCliente: 1, NombreMostrar: 'Cliente de prueba', TipoCliente: 'INDIVIDUAL', NIT: 'CF' }] },
      historial: { status: 'success', data: [{ IdCliente: 1, IdEquipo: null, NumeroSerie: null, IdOrden: null, NumeroOrden: null, FechaIngreso: null, Estado: null, Prioridad: null, IdDiagnostico: null, Diagnostico: null, Tecnico: null, NumeroFactura: null, TotalFactura: '0.00' }] },
    } }} />)
    fireEvent.change(screen.getByLabelText('Reporte *'), { target: { value: 'historial-cliente' } })
    expect(screen.getByRole('table', { name: 'Cliente' })).toHaveTextContent('Cliente de prueba')
    const rows = screen.getByRole('table', { name: 'Equipos, órdenes y diagnósticos' })
    expect(rows).toHaveTextContent('0.00')
    expect(within(rows).getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('Consulta sin resultados')).not.toBeInTheDocument()
  })
  it('valida filtros sin consultar, exportar ni persistir, y cancelar limpia y devuelve foco', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<ReportesPage />)
    const selector = screen.getByLabelText('Reporte *')
    fireEvent.change(selector, { target: { value: 'historial-equipo' } })
    fireEvent.change(screen.getByLabelText('Número de serie *'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('obligatorio')
    fireEvent.change(screen.getByLabelText('Número de serie *'), { target: { value: 'Serie de prueba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('status')).toHaveTextContent('No se ha ejecutado una consulta')
    expect(fetchSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(selector).toHaveFocus()
    expect(screen.getByLabelText('Número de serie *')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
