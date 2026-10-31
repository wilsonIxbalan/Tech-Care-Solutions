import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RepuestosPage } from '@/features/repuestos/repuestos-page'
import { createRepuestoSchema } from '@/features/repuestos/repuesto-model'
import { adminUser, categoria, json, list, mockSupply, renderWithSession, repuesto, writes } from '../inventario/supply-fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const valid = { idCategoria: '1', codigo: 'PR', nombre: 'Prueba', descripcion: '', precioCompraReferencia: '0', precioVenta: '12.50' }
describe('repuestos HTTP', () => {
  it('valida categorías, límites y decimales sin existencia editable', () => {
    const schema = createRepuestoSchema([categoria])
    expect(schema.parse({ ...valid, existencia: 10 })).not.toHaveProperty('existencia')
    for (const patch of [{ idCategoria: '3' }, { nombre: ' ' }, { codigo: 'x'.repeat(31) }, { precioVenta: '1.001' }, { precioCompraReferencia: '-1' }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
  it('obtiene categorías, crea repuesto y normaliza dinero exacto por POST', async () => {
    const http = mockSupply(); renderWithSession(<RepuestosPage />)
    const trigger = await screen.findByRole('button', { name: 'Nuevo repuesto' })
    await waitFor(() => expect(trigger).toBeEnabled()); fireEvent.click(trigger)
    for (const [label, value] of [['Categoría *', '1'], ['Código *', 'PR'], ['Nombre *', 'Prueba'], ['Precio de compra de referencia *', '000.1'], ['Precio de venta *', '9999999999.99']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar repuesto' }))
    await waitFor(() => expect(writes(http)).toHaveLength(1))
    expect(JSON.parse(String(writes(http)[0][1]?.body))).toEqual({ idCategoria: 1, codigo: 'PR', nombre: 'Prueba', descripcion: null, precioCompraReferencia: '0.10', precioVenta: '9999999999.99', estado: 'ACTIVO' })
    expect(screen.queryByLabelText(/existencia|stock/i)).not.toBeInTheDocument()
  })
  it('PATCH de precios usa API, conserva código de solo lectura e invalida inventario', async () => {
    const http = mockSupply(); const { client } = renderWithSession(<RepuestosPage />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const edit = await screen.findByRole('button', { name: `Editar ${repuesto.nombre}` })
    await waitFor(() => expect(edit).toBeEnabled()); fireEvent.click(edit)
    expect(screen.getByLabelText('Código *')).toHaveAttribute('readonly')
    fireEvent.change(screen.getByLabelText('Precio de venta *'), { target: { value: '0.3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar repuesto' }))
    await waitFor(() => expect(writes(http)).toHaveLength(1))
    expect(writes(http)[0][0]).toContain('/repuestos/202'); expect(writes(http)[0][1]?.method).toBe('PATCH')
    expect(JSON.parse(String(writes(http)[0][1]?.body))).toMatchObject({ precioVenta: '0.30', codigo: 'R202' })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inventario'] })
  })
  it('pagina y busca repuestos remotamente, incluyendo filtros', async () => {
    const http = mockSupply(url => url.pathname.endsWith('/repuestos') ? json(list([repuesto], Number(url.searchParams.get('page')), 2)) : undefined)
    renderWithSession(<RepuestosPage />); await screen.findByText(repuesto.nombre)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente repuestos' }))
    await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true))
    fireEvent.change(screen.getByLabelText('Buscar por código o nombre'), { target: { value: 'R202' } })
    fireEvent.change(screen.getByLabelText('Filtrar por categoría'), { target: { value: '1' } })
    await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes('search=R202') && String(url).includes('idCategoria=1') && String(url).includes('page=1'))).toBe(true))
  })
  it('REPORTES_VER no concede escritura de repuestos', async () => {
    mockSupply(); renderWithSession(<RepuestosPage />, { user: { ...adminUser, roles: ['CAJA'], permisos: ['REPORTES_VER'] } })
    await screen.findByText(repuesto.nombre)
    expect(screen.queryByRole('button', { name: /Nuevo repuesto|Editar/ })).not.toBeInTheDocument()
  })
})
