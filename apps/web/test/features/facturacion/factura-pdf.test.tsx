import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FacturaDetalle } from '@/features/facturacion/factura-detalle'
import type { FacturaDetalleDto } from '@/types/domain'
import { adminUser, json, renderWithSession as render } from '../../support/session'

const factura: FacturaDetalleDto = { idFactura: 7, numeroFactura: 'F-7', idOrden: 9, numeroOrden: 'OS-9', idCliente: 1, clienteNombre: 'Ana', nitFacturacion: 'CF', nombreFacturacion: 'Ana', direccionFacturacion: null, fechaFactura: '2026-10-22T12:00:00Z', subtotalManoObra: '10.00', subtotalRepuestos: '0.00', porcentajeImpuesto: '12.00', subtotal: '10.00', impuesto: '1.20', total: '11.20', totalPagado: '0.00', saldo: '11.20', estado: 'EMITIDA', detalles: [], pagos: [] }
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('PDF de factura persistida', () => {
  it.each(['ADMINISTRADOR', 'CAJA'] as const)('descarga por GET para %s sin emitir factura nueva', async role => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } })))
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue('blob:factura'), revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<FacturaDetalle factura={factura} />, { user: { ...adminUser, roles: [role], permisos: ['REPORTES_VER'] } })
    const button = screen.getByRole('button', { name: 'Descargar PDF' })
    expect(button).toHaveAccessibleDescription(/factura emitida.*sin validez fiscal/i)
    fireEvent.click(button)
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/facturas/7/pdf')
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' })
    expect(screen.getByText('F-7 · EMITIDA')).toBeVisible()
  })
  it.each(['FACTURAR', 'PAGOS_REGISTRAR', 'REPORTES_VER'])('acepta el permiso alternativo %s para Caja', permission => {
    render(<FacturaDetalle factura={factura} />, { user: { ...adminUser, roles: ['CAJA'], permisos: [permission] } })
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeEnabled()
  })
  it.each(['TECNICO', 'RECEPCION', 'BODEGA'] as const)('no ofrece PDF a %s aun con permiso', role => {
    render(<FacturaDetalle factura={factura} />, { user: { ...adminUser, roles: [role] } })
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).not.toBeInTheDocument()
    expect(screen.getByText('F-7 · EMITIDA')).toBeVisible()
  })
  it('no ofrece PDF sin uno de los permisos aunque sea administrador', () => {
    render(<FacturaDetalle factura={factura} />, { user: { ...adminUser, permisos: [] } })
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).not.toBeInTheDocument()
  })
  it('muestra error contractual y no reintenta ni genera otra factura', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { code: 'NO_ENCONTRADO', message: 'La factura no existe.' }, requestId: 'pdf-error' }, 404)))
    render(<FacturaDetalle factura={factura} />)
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La factura no existe. Referencia: pdf-error')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeEnabled()
  })
})
