import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FacturacionPage } from './facturacion-page'
import { createFacturacionSchema, createPagoSchema } from './facturacion-schema'
import type { FacturaDetalleDto } from '@/types/domain'

const factura: FacturaDetalleDto = {
  idFactura: 1, numeroFactura: 'Prueba-F', idOrden: 2, numeroOrden: 'Prueba-O', idCliente: 3, clienteNombre: 'Cliente de prueba', nitFacturacion: 'CF', nombreFacturacion: 'Nombre de prueba', direccionFacturacion: null, fechaFactura: '2026-10-22T12:00:00Z', subtotalManoObra: '10.00', subtotalRepuestos: '0.00', porcentajeImpuesto: '12.00', subtotal: '10.00', impuesto: '1.20', total: '11.20', totalPagado: '1.20', saldo: '10.00', estado: 'EMITIDA', detalles: [],
  pagos: [
    { idPago: 1, idFactura: 1, idMetodoPago: 1, metodoPagoNombre: 'Método de prueba', monto: '1.20', fechaPago: '2026-10-22T12:00:00Z', referencia: null, idUsuario: 1, usuarioNombre: 'Usuario de prueba', estado: 'APLICADO', motivoAnulacion: null },
    { idPago: 2, idFactura: 1, idMetodoPago: 1, metodoPagoNombre: 'Método de prueba', monto: '5.00', fechaPago: '2026-10-22T12:00:00Z', referencia: null, idUsuario: 1, usuarioNombre: 'Usuario de prueba', estado: 'ANULADO', motivoAnulacion: 'Motivo de prueba' },
  ],
}
const metodos = [{ idMetodoPago: 1, nombre: 'Método de prueba', activo: true }]
const valid = { idFactura: '1', idMetodoPago: '1', monto: '10.00', referencia: '' }
describe('facturación y pagos', () => {
  it('invalida el mensaje anterior y vuelve a comprobar un saldo actualizado sin borrar el borrador', async () => {
    const { rerender } = render(<FacturacionPage facturas={{ status: 'success', data: [factura] }} metodos={metodos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preparar pago' }))
    for (const [label, value] of [['Factura *', '1'], ['Método de pago *', '1'], ['Monto *', '10.00']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    await screen.findByRole('status')
    rerender(<FacturacionPage facturas={{ status: 'success', data: [{ ...factura, saldo: '5.00' }] }} metodos={metodos} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Monto *')).toHaveValue('10.00')
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('supera el saldo recibido')
  })
  it('hereda opcionales como null, limita datos fiscales y requiere orden LISTO recibida', () => {
    const schema = createFacturacionSchema([{ idOrden: 2, numeroOrden: 'Prueba', estado: 'LISTO' }])
    const value = { idOrden: '2', nitFacturacion: '', nombreFacturacion: '  ', direccionFacturacion: '' }
    expect(schema.parse(value).nombreFacturacion).toBeNull()
    expect(schema.safeParse({ ...value, nitFacturacion: 'x'.repeat(21) }).success).toBe(false)
    expect(createFacturacionSchema().safeParse(value).success).toBe(false)
    expect(createFacturacionSchema([{ idOrden: 2, numeroOrden: 'Prueba', estado: 'REPARACION' }]).safeParse(value).success).toBe(false)
  })
  it('admite pagos parciales o exactos y rechaza exceso de un centavo, cero, decimales y catálogos inválidos', () => {
    const schema = createPagoSchema([factura], metodos)
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, monto: '0.01' }).success).toBe(true)
    for (const patch of [{ monto: '10.01' }, { monto: '0' }, { monto: '-1' }, { monto: '1.001' }, { monto: ' ' }, { idMetodoPago: '2' }, { referencia: 'x'.repeat(61) }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
    expect(createPagoSchema([{ ...factura, estado: 'ANULADA' }], metodos).safeParse(valid).success).toBe(false)
    expect(createPagoSchema([{ ...factura, saldo: '10' }], metodos).safeParse(valid).success).toBe(false)
    expect(createPagoSchema([factura], [{ ...metodos[0], activo: false }]).safeParse(valid).success).toBe(false)
    expect(createPagoSchema().safeParse(valid).success).toBe(false)
  })
  it('mantiene formularios disponibles sin catálogos y bloquea sólo su validación completa', () => {
    render(<FacturacionPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Preparar datos de facturación' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preparar pago' }))
    expect(screen.getAllByRole('button', { name: 'Validar datos' }).every(button => button.hasAttribute('disabled'))).toBe(true)
  })
  it('muestra pagos aplicados y anulados sin recalcular el saldo recibido', () => {
    render(<FacturacionPage facturas={{ status: 'success', data: [{ ...factura, detalles: [{ idDetalleFactura: 1, tipoLinea: 'MANO_OBRA', idReparacion: 11, idRepuestoReparacion: null, descripcion: 'Concepto histórico de prueba', cantidad: '2.00', precioUnitario: '5.00', subtotal: '10.00' }] }] }} />)
    fireEvent.change(screen.getByLabelText('Ver detalle recibido'), { target: { value: '1' } })
    const detail = within(screen.getByRole('region', { name: 'Detalle de factura' }))
    expect(detail.getByText('APLICADO')).toBeVisible()
    expect(detail.getByText('ANULADO')).toBeVisible()
    expect(detail.getByText('Motivo de prueba')).toBeVisible()
    expect(detail.getByText('Saldo (Q)').nextElementSibling).toHaveTextContent('10.00')
    expect(detail.getByRole('table', { name: 'Líneas de factura' })).toHaveTextContent('Reparación #11')
    expect(detail.getByRole('table', { name: 'Líneas de factura' })).toHaveTextContent('Q 5.00')
  })
  it('valida sin red ni persistencia y cancela limpiando mensajes y valores', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<FacturacionPage facturas={{ status: 'success', data: [factura] }} metodos={metodos} />)
    const trigger = screen.getByRole('button', { name: 'Preparar pago' })
    fireEvent.click(trigger)
    for (const [label, value] of [['Factura *', '1'], ['Método de pago *', '1'], ['Monto *', '0.10']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Todavía no se ha registrado ni cobrado')
    expect(fetchSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Monto *')).toHaveValue('')
    vi.restoreAllMocks()
  })
})
