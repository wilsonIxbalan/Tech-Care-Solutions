import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComprasPage } from './compras-page'
import { createCompraSchema, estimatePurchase } from './compra-schema'
import type { CompraCatalogos } from './compra-schema'
import type { CompraDetalleDto } from '@/types/domain'

const catalogos: CompraCatalogos = {
  proveedores: [{ idProveedor: 1, nit: 'Prueba', nombre: 'Proveedor de prueba', nombreContacto: null, telefono: 'Prueba', email: null, direccion: null, estado: 'ACTIVO' }],
  bodegas: [{ idBodega: 2, nombre: 'Bodega de prueba', estado: 'ACTIVA' }],
  repuestos: [3, 4].map(idRepuesto => ({ idRepuesto, idCategoria: 1, codigo: `P${idRepuesto}`, nombre: `Repuesto de prueba ${idRepuesto}`, descripcion: null, precioCompraReferencia: '1.00', precioVenta: '2.00', estado: 'ACTIVO' })),
}
const valid = { idProveedor: '1', idBodegaDestino: '2', numeroDocumentoProveedor: '', observaciones: '', items: [{ idRepuesto: '3', cantidad: '2', costoUnitario: '0.10' }] }
describe('compras', () => {
  it('selecciona y revisa el encabezado histórico, conserva nulos y no sustituye costos por precios actuales', () => {
    const compra: CompraDetalleDto = { idCompra: 8, numeroCompra: 'Compra de prueba', idProveedor: 1, proveedorNombre: 'Proveedor de prueba', idBodegaDestino: 2, bodegaNombre: 'Bodega de prueba', idUsuarioRegistro: 5, fechaCompra: '2026-10-22T12:00:00Z', fechaRecepcion: null, idUsuarioRecepcion: null, numeroDocumentoProveedor: null, estado: 'PENDIENTE', observaciones: 'Observación histórica de prueba', total: '0.20', items: [{ idDetalleCompra: 1, idRepuesto: 3, codigoRepuesto: 'PR', repuestoNombre: 'Repuesto de prueba', cantidad: 2, costoUnitario: '0.10', subtotal: '0.20' }] }
    const { rerender } = render(<ComprasPage catalogos={catalogos} compras={{ status: 'success', data: [compra] }} detalles={{ status: 'success', data: [compra] }} />)
    fireEvent.change(screen.getByLabelText('Ver detalle de compra recibido'), { target: { value: '8' } })
    expect(screen.getByText('Recepción (UTC)').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByText('Documento del proveedor').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByText('Observación histórica de prueba')).toBeVisible()
    expect(screen.getByRole('table', { name: 'Líneas de compra' })).toHaveTextContent('Q 0.10')
    rerender(<ComprasPage compras={{ status: 'success', data: [compra] }} detalles={{ status: 'loading' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando detalles')
    expect(screen.queryByRole('table', { name: 'Líneas de compra' })).not.toBeInTheDocument()
    rerender(<ComprasPage compras={{ status: 'success', data: [compra] }} detalles={{ status: 'error', message: 'Error de detalle recibido' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Error de detalle recibido')
  })
  it('muestra el error de detalle vacío junto a su región después de quitar todas las líneas', async () => {
    render(<ComprasPage catalogos={catalogos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preparar compra' }))
    fireEvent.change(screen.getByLabelText('Proveedor *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Bodega destino *'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Quitar línea 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Agrega al menos un repuesto')
    expect(screen.getByRole('region', { name: 'Detalle del borrador' })).toHaveAccessibleDescription('Agrega al menos un repuesto.')
  })
  it('valida catálogos activos, detalle obligatorio, unicidad, cantidades y límite SQL por línea', () => {
    const schema = createCompraSchema(catalogos)
    expect(schema.safeParse(valid).success).toBe(true)
    for (const patch of [{ idProveedor: ' ' }, { idBodegaDestino: '9' }, { items: [] }, { items: [valid.items[0], valid.items[0]] }, { items: [{ ...valid.items[0], cantidad: '0' }] }, { items: [{ ...valid.items[0], cantidad: '1.5' }] }, { items: [{ ...valid.items[0], cantidad: '2147483648' }] }, { items: [{ ...valid.items[0], cantidad: '101', costoUnitario: '9999999999.99' }] }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
    expect(createCompraSchema({}).safeParse(valid).success).toBe(false)
    expect(createCompraSchema({ ...catalogos, proveedores: catalogos.proveedores?.map(p => ({ ...p, estado: 'INACTIVO' })) }).safeParse(valid).success).toBe(false)
  })
  it('calcula exactamente centavos, cantidades y cero sin redondear', () => {
    expect(estimatePurchase([{ cantidad: '3', costoUnitario: '0.10' }, { cantidad: '1', costoUnitario: '0.20' }])).toBe('0.50')
    expect(estimatePurchase([{ cantidad: '100', costoUnitario: '9999999999.99' }])).toBe('999999999999.00')
    expect(estimatePurchase([{ cantidad: '1', costoUnitario: '0' }])).toBe('0.00')
    expect(estimatePurchase([{ cantidad: '1', costoUnitario: '0.001' }])).toBeNull()
  })
  it('bloquea sin catálogos y limpia borrador y foco al cancelar', () => {
    render(<ComprasPage />)
    const trigger = screen.getByRole('button', { name: 'Preparar compra' })
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    expect(screen.getAllByRole('group')).toHaveLength(1)
    expect(screen.getByLabelText('Cantidad *')).toHaveValue('')
  })
  it('agrega y quita líneas, valida sin red, persistencia ni recepción', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<ComprasPage catalogos={catalogos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preparar compra' }))
    fireEvent.change(screen.getByLabelText('Proveedor *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Bodega destino *'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }))
    for (const [index, group] of screen.getAllByRole('group').entries()) {
      fireEvent.change(within(group).getByLabelText('Repuesto *'), { target: { value: String(index + 3) } })
      fireEvent.change(within(group).getByLabelText('Cantidad *'), { target: { value: '1' } })
      fireEvent.change(within(group).getByLabelText('Costo unitario *'), { target: { value: '0.10' } })
    }
    expect(screen.getByText('0.20')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar línea 2' }))
    expect(screen.getByRole('button', { name: 'Agregar línea' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('status')).toHaveTextContent('aún no se ha guardado ni recibido')
    expect(fetchSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /^Recibir/ })).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
