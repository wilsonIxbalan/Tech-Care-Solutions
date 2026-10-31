import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { FacturacionPage } from '@/features/facturacion/facturacion-page'
import { PagoForm } from '@/features/facturacion/pago-form'
import { anularPagoSchema, createFacturacionSchema, createPagoSchema, porcentajeImpuestoSchema } from '@/features/facturacion/facturacion-schema'
import { FacturaDetalle } from '@/features/facturacion/factura-detalle'
import { adminUser, json, renderWithSession as render } from '../../support/session'
import { factura, failure, metodos, mockBilling, page, posts } from './fixtures'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const valid = { idFactura: '1', idMetodoPago: '1', monto: '10.00', referencia: '' }

async function openDetail() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ver factura F-1' }))
  await screen.findByRole('table', { name: 'Pagos de la factura' })
}
async function openPay() {
  await openDetail()
  const button = await screen.findByRole('button', { name: 'Nuevo pago' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Método de pago *'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Monto *'), { target: { value: '0.10' } })
  fireEvent.change(screen.getByLabelText('Referencia'), { target: { value: 'REC-123' } })
}

describe('contratos de facturación y pagos', () => {
  it('hereda opcionales como null, limita datos fiscales y exige orden LISTO recibida', () => {
    const schema = createFacturacionSchema([{ idOrden: 2, numeroOrden: 'OS-2', estado: 'LISTO' }])
    const value = { idOrden: '2', nitFacturacion: '', nombreFacturacion: '  ', direccionFacturacion: '' }
    expect(schema.parse(value)).toMatchObject({ nombreFacturacion: null, nitFacturacion: null, direccionFacturacion: null, porcentajeImpuesto: '12.00' })
    for (const patch of [{ nitFacturacion: 'x'.repeat(21) }, { nombreFacturacion: 'x'.repeat(151) }, { direccionFacturacion: 'x'.repeat(251) }]) expect(schema.safeParse({ ...value, ...patch }).success).toBe(false)
    expect(createFacturacionSchema().safeParse(value).success).toBe(false)
    expect(createFacturacionSchema([{ idOrden: 2, numeroOrden: 'OS-2', estado: 'REPARACION' }]).safeParse(value).success).toBe(false)
  })
  it('normaliza porcentaje sin redondear y limita 0 a 100; exige motivo acotado', () => {
    for (const value of ['0', '12.00', '100']) expect(porcentajeImpuestoSchema.safeParse(value).success).toBe(true)
    for (const value of ['', '-1', '100.01', '1.234', '1e2']) expect(porcentajeImpuestoSchema.safeParse(value).success).toBe(false)
    expect(anularPagoSchema.parse({ motivo: '  Error en referencia  ' }).motivo).toBe('Error en referencia')
    expect(anularPagoSchema.safeParse({ motivo: '  ' }).success).toBe(false)
    expect(anularPagoSchema.safeParse({ motivo: 'x'.repeat(301) }).success).toBe(false)
  })
  it('admite pagos parciales y exactos; rechaza exceso de un centavo, cero, precisión y catálogos inválidos', () => {
    const schema = createPagoSchema([factura], metodos)
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, monto: '0.01' }).success).toBe(true)
    for (const patch of [{ monto: '10.01' }, { monto: '0' }, { monto: '-1' }, { monto: '1.001' }, { monto: ' ' }, { idMetodoPago: '2' }, { referencia: 'x'.repeat(61) }]) expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false)
    for (const updated of [{ ...factura, estado: 'ANULADA' as const }, { ...factura, estado: 'PAGADA' as const }, { ...factura, saldo: '10' }]) expect(createPagoSchema([updated], metodos).safeParse(valid).success).toBe(false)
    expect(createPagoSchema([factura], [{ ...metodos[0], activo: false }]).safeParse(valid).success).toBe(false)
    expect(createPagoSchema().safeParse(valid).success).toBe(false)
  })
  it('vuelve a validar un saldo actualizado sin borrar el monto ingresado', async () => {
    const { rerender } = render(<PagoForm facturas={[factura]} metodos={metodos} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Método de pago *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Monto *'), { target: { value: '10.00' } })
    // The form's public data props remain compatible while its submit is now operational.
    rerender(<PagoForm facturas={[{ ...factura, saldo: '5.00' }]} metodos={metodos} onCancel={() => {}} />)
    expect(screen.getByLabelText('Monto *')).toHaveValue('10.00')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('supera el saldo recibido')
  })
  it('muestra históricos aplicados y anulados sin reconstruir el saldo', () => {
    render(<FacturaDetalle factura={factura} />)
    const table = screen.getByRole('table', { name: 'Pagos de la factura' })
    expect(table).toHaveTextContent('APLICADO'); expect(table).toHaveTextContent('ANULADO'); expect(table).toHaveTextContent('Referencia duplicada')
    expect(screen.getByText('Saldo (Q)').nextElementSibling).toHaveTextContent('10.00')
    expect(screen.getByRole('table', { name: 'Líneas de factura' })).toHaveTextContent('Reparación #11')
  })
})

describe('consulta operativa de facturas', () => {
  it('pagina en servidor y aplica búsqueda, cliente, estado, saldo y fechas reiniciando la página', async () => {
    const fetchMock = mockBilling(url => url.pathname === '/api/v1/facturas' ? json(page([factura], Number(url.searchParams.get('page')), 3)) : undefined)
    render(<FacturacionPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await screen.findByText(/Página 2 de 3/)
    for (const [label, value] of [['Buscar facturas', 'Ana'], ['ID de cliente', '3'], ['Fecha desde', '2026-10-01'], ['Fecha hasta', '2026-10-22'], ['Estado', 'EMITIDA'], ['Saldo', 'true'], ['Por página', '10']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('search=Ana'))).toBe(true))
    const url = new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://localhost')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', pageSize: '10', search: 'Ana', estado: 'EMITIDA', conSaldo: 'true', idCliente: '3', fechaDesde: '2026-10-01', fechaHasta: '2026-10-22' })
    expect(posts(fetchMock)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByLabelText('Buscar facturas')).toHaveValue('')
  })
  it('muestra carga, error con reconsulta y lista vacía sin datos de muestra', async () => {
    let resolve!: (response: Response) => void
    let failed = true
    const fetchMock = mockBilling(url => url.pathname === '/api/v1/facturas' ? failed ? new Promise<Response>(done => { resolve = done }) : json(page([])) : undefined)
    render(<FacturacionPage />)
    expect(screen.getByText('Consultando facturas…')).toBeVisible()
    resolve(failure(400, 'Filtros no válidos.'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Filtros no válidos.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    failed = false
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByText('Sin facturas para estos filtros')).toBeVisible()
    expect(posts(fetchMock)).toHaveLength(0)
  })
  it('rechaza ID inválido sin enviar consulta nueva', async () => {
    const fetchMock = mockBilling()
    render(<FacturacionPage />)
    await screen.findByRole('table', { name: 'Facturas' })
    fireEvent.change(screen.getByLabelText('ID de cliente'), { target: { value: '-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(screen.getByRole('alert')).toHaveTextContent('ID de cliente válido')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it.each(['FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER'])('permite lectura por %s sin ampliar permisos de escritura ni PDF por rol', async permission => {
    mockBilling()
    render(<FacturacionPage />, { user: { ...adminUser, roles: ['RECEPCION'], permisos: [permission] } })
    await openDetail()
    expect(screen.getByText('F-1 · EMITIDA')).toBeVisible()
    expect(Boolean(screen.queryByRole('button', { name: 'Nueva factura' }))).toBe(permission === 'FACTURAR')
    expect(Boolean(screen.queryByRole('button', { name: 'Nuevo pago' }))).toBe(permission === 'PAGOS_REGISTRAR')
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Anular factura/ })).not.toBeInTheDocument()
  })
  it('no consulta facturas ni ofrece operaciones sin permisos aunque sea administrador', () => {
    const fetchMock = mockBilling()
    render(<FacturacionPage />, { user: { ...adminUser, permisos: [] } })
    expect(screen.getByText('Acceso restringido')).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('selecciona la factura por ID y muestra error de detalle sin fabricar cabecera', async () => {
    const fetchMock = mockBilling(url => url.pathname === '/api/v1/facturas/1' ? failure(404, 'La factura no existe.') : undefined)
    render(<FacturacionPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ver factura F-1' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La factura no existe.')
    expect(screen.queryByRole('table', { name: 'Pagos de la factura' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/facturas/1')).toBe(true)
  })
})

describe('registro de pago confirmado', () => {
  it('envía sólo contrato de pago parcial, bloquea duplicados e invalida las lecturas afectadas', async () => {
    let resolve!: (response: Response) => void
    const fetchMock = mockBilling((_url, init) => init?.method === 'POST' ? new Promise<Response>(done => { resolve = done }) : undefined)
    const success = vi.spyOn(toast, 'success')
    const { client } = render(<FacturacionPage />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await openPay()
    expect(screen.queryByRole('option', { name: 'Inactivo' })).not.toBeInTheDocument()
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar pago' }))
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar pago' }))
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1))
    expect(success).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ver factura F-1' })).toBeDisabled()
    const [url, init] = posts(fetchMock)[0]
    expect(url).toBe('/api/v1/facturas/1/pagos')
    expect(JSON.parse(String(init?.body))).toEqual({ idMetodoPago: 1, monto: '0.10', referencia: 'REC-123' })
    resolve(json({ data: { idPago: 3, idFactura: 1, saldo: '9.90', estadoFactura: 'EMITIDA' } }, 201))
    await waitFor(() => expect(success).toHaveBeenCalledWith('Pago registrado correctamente.'))
    expect(screen.queryByRole('form', { name: 'Registrar pago' })).not.toBeInTheDocument()
    for (const key of ['facturas', 'dashboard', 'ordenes', 'facturacion-ordenes', 'facturacion-resumen']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
  })
  it.each([400, 409])('preserva monto/referencia ante HTTP %s y muestra detalles sin éxito', async status => {
    const fetchMock = mockBilling((_url, init) => init?.method === 'POST' ? failure(status, 'Saldo o referencia no válidos.', { referencia: ['Verifica la referencia.'] }) : undefined)
    const success = vi.spyOn(toast, 'success')
    render(<FacturacionPage />)
    await openPay()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('referencia: Verifica la referencia.')
    expect(screen.getByLabelText('Monto *')).toHaveValue('0.10')
    expect(screen.getByLabelText('Referencia')).toHaveValue('REC-123')
    expect(posts(fetchMock)).toHaveLength(1); expect(success).not.toHaveBeenCalled()
  })
  it.each(['network', 'invalid', 'wrong-invoice', 'server'])('no repite ni afirma éxito con respuesta %s', async mode => {
    const fetchMock = mockBilling((_url, init) => {
      if (init?.method !== 'POST') return undefined
      if (mode === 'network') return Promise.reject(new TypeError('Network error'))
      if (mode === 'server') return failure(503)
      return json({ data: { idPago: 3, idFactura: mode === 'wrong-invoice' ? 99 : 1, saldo: mode === 'invalid' ? 9.90 : '9.90', estadoFactura: 'EMITIDA' } }, 201)
    })
    const success = vi.spyOn(toast, 'success')
    render(<FacturacionPage />)
    await openPay()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El resultado no está confirmado')
    expect(screen.getByLabelText('Monto *')).toHaveValue('0.10')
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar pago' }))
    expect(posts(fetchMock)).toHaveLength(1); expect(success).not.toHaveBeenCalled()
  })
  it('bloquea pago local que excede saldo y no permite pago con catálogo vacío', async () => {
    const fetchMock = mockBilling(url => url.pathname === '/api/v1/catalogos' ? json({ data: { metodosPago: [] } }) : undefined)
    render(<FacturacionPage />)
    await openDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo pago' }))
    await screen.findByText('No hay métodos de pago activos disponibles.')
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
    expect(posts(fetchMock)).toHaveLength(0)
  })
  it('no ofrece pago de factura saldada pero conserva el histórico', async () => {
    mockBilling(url => url.pathname === '/api/v1/facturas/1' ? json({ data: { ...factura, estado: 'PAGADA', saldo: '0.00' } }) : undefined)
    render(<FacturacionPage />)
    await openDetail()
    expect(screen.queryByRole('button', { name: 'Nuevo pago' })).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Pagos de la factura' })).toHaveTextContent('APLICADO')
  })
  it('mantiene el detalle y monto si falla la reconsulta posterior a un rechazo', async () => {
    let rejected = false
    mockBilling((url, init) => {
      if (init?.method === 'POST') { rejected = true; return failure(409) }
      if (rejected && url.pathname === '/api/v1/facturas/1') return failure(503)
      return undefined
    })
    render(<FacturacionPage />)
    await openPay()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2))
    expect(screen.getByLabelText('Monto *')).toHaveValue('0.10')
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
    expect(within(screen.getByRole('region', { name: 'Detalle de factura' })).getByText('F-1 · EMITIDA')).toBeVisible()
  })
})
