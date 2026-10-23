import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RepuestosPage } from './repuestos-page'
import { createRepuestoSchema } from './repuesto-model'

const categorias = [{ idCategoria: 2, nombre: 'Categoría de prueba' }]
const valid = { idCategoria: '2', codigo: 'PR', nombre: 'Prueba', descripcion: '', precioCompraReferencia: '0', precioVenta: '12.50' }
describe('repuestos', () => {
  it('valida pertenencia, espacios, límites y decimales sin stock editable', () => {
    const schema = createRepuestoSchema(categorias)
    expect(schema.parse({ ...valid, existencia: 10 })).not.toHaveProperty('existencia')
    for (const patch of [{ idCategoria: '3' }, { nombre: '   ' }, { codigo: 'x'.repeat(31) }, { precioVenta: '1.001' }, { precioCompraReferencia: '-1' }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
    expect(createRepuestoSchema().safeParse(valid).success).toBe(false)
  })
  it('mantiene visible el formulario sin catálogos, bloquea y devuelve el foco al cancelar', () => {
    render(<RepuestosPage />)
    const trigger = screen.getByRole('button', { name: 'Preparar repuesto' })
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Temporal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    expect(screen.getByLabelText('Nombre *')).toHaveValue('')
    expect(screen.queryByLabelText(/existencia/i)).not.toBeInTheDocument()
  })
  it('valida un borrador con catálogo sin red ni persistencia', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    render(<RepuestosPage categorias={categorias} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preparar repuesto' }))
    for (const [label, value] of [['Categoría *', '2'], ['Código *', 'PR'], ['Nombre *', 'Prueba'], ['Precio de compra de referencia *', '0'], ['Precio de venta *', '12.50']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('status')).toHaveTextContent('aún no se ha guardado')
    expect(fetchSpy).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
