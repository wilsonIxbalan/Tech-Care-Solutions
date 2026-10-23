import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EntregasPage } from './entregas-page'
import { createEntregaSchema, permiteBorradorEntrega } from './entrega-schema'
import type { OrdenEntrega } from './entrega-schema'

const orden: OrdenEntrega = { idOrden: 1, numeroOrden: 'Orden de prueba', estado: 'LISTO', factura: { idFactura: 2, idOrden: 1, estado: 'PAGADA', saldo: '0.00' } }
const valid = { idOrden: '1', nombreRecibe: 'Receptor de prueba', documentoRecibe: '', observaciones: '' }
describe('entrega preliminar', () => {
  it('exige relación, factura vigente, estado y saldo verificables; cero de una factura anulada no autoriza entrega', () => {
    expect(permiteBorradorEntrega(orden)).toBe(true)
    for (const patch of [{ factura: undefined }, { factura: null }, { estado: 'REPARACION' as const }, { factura: { ...orden.factura!, estado: 'ANULADA' as const } }, { factura: { ...orden.factura!, idOrden: 9 } }, { factura: { ...orden.factura!, saldo: '0.01' } }, { factura: { ...orden.factura!, saldo: '0' } }]) {
      expect(permiteBorradorEntrega({ ...orden, ...patch })).toBe(false)
      expect(createEntregaSchema([{ ...orden, ...patch }]).safeParse(valid).success).toBe(false)
    }
    const schema = createEntregaSchema([orden])
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, nombreRecibe: ' ' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, documentoRecibe: 'x'.repeat(31) }).success).toBe(false)
  })
  it('permite abrir el formulario pero no declara elegibilidad sin datos', () => {
    render(<EntregasPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Preparar entrega' }))
    expect(screen.getAllByText('Pendiente de verificar')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    expect(screen.getByLabelText('Nombre de quien recibe *')).toBeEnabled()
  })
  it('valida sin red ni persistencia; cancelar limpia y devuelve el foco', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<EntregasPage ordenes={[orden]} />)
    const trigger = screen.getByRole('button', { name: 'Preparar entrega' })
    fireEvent.click(trigger)
    fireEvent.change(screen.getByLabelText('Orden *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Nombre de quien recibe *'), { target: { value: 'Receptor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Todavía no se ha registrado una entrega')
    expect(fetchSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    expect(screen.getByLabelText('Nombre de quien recibe *')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
