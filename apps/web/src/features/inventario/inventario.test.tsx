import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InventarioPage } from './inventario-page'
import { stockLabel } from './inventario-model'
import { dateRangeSchema, guatemalaCivilDay, inCivilRange } from '@/lib/civil-date'
import type { InventarioDto } from '@/types/domain'

const rows: InventarioDto[] = [0, 2, 3].map((existencia, i) => ({ idBodega: 1, bodegaNombre: 'Bodega de prueba', idCategoria: 1, categoriaNombre: 'Categoría de prueba', idRepuesto: i + 1, codigoRepuesto: `P${i}`, repuestoNombre: `Repuesto de prueba ${i}`, existencia, stockMinimo: 2, bajoMinimo: existencia <= 2, sinStock: existencia === 0, fechaUltimoMovimiento: null }))
describe('inventario recibido', () => {
  it('distingue cero, igualdad al mínimo y existencia superior', () => {
    expect(rows.map(stockLabel)).toEqual(['Sin stock', 'Igual o inferior al mínimo', 'Sobre el mínimo'])
  })
  it.each(['pending', 'loading', 'error', 'success'] as const)('representa sólo el estado %s recibido', status => {
    render(<InventarioPage inventario={status === 'success' ? { status, data: [] } : status === 'error' ? { status, message: 'Error de prueba' } : { status }} />)
    if (status === 'success') expect(screen.getByText('Consulta sin resultados')).toBeVisible()
    else expect(screen.queryByText('Consulta sin resultados')).not.toBeInTheDocument()
    if (status === 'error') expect(screen.getByRole('alert')).toHaveTextContent('Error de prueba')
    if (status === 'loading') expect(screen.getByRole('status')).toHaveTextContent('Consultando')
  })
  it('filtra filas recibidas y limpia sin editar existencias', async () => {
    render(<InventarioPage inventario={{ status: 'success', data: rows }} />)
    fireEvent.change(screen.getByLabelText('Situación de existencias'), { target: { value: 'minimo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros a datos recibidos' }))
    expect(await screen.findByText('Sin stock')).toBeVisible()
    await waitFor(() => expect(screen.queryByText('Repuesto de prueba 2')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByText('Repuesto de prueba 2')).toBeVisible()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
  it('usa Guatemala con zona explícita y límites exclusivos sin conversiones implícitas', () => {
    expect(guatemalaCivilDay('2026-10-22T01:00:00Z')).toBe('2026-10-21')
    expect(guatemalaCivilDay('2026-10-22T01:00:00')).toBeNull()
    expect(inCivilRange('2026-10-22T06:00:00Z', '2026-10-21', '2026-10-22')).toBe(false)
    expect(dateRangeSchema.safeParse({ desde: '2026-10-22', hastaExclusiva: '2026-10-22' }).success).toBe(false)
  })
})

