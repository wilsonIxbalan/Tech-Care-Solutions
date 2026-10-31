import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InventarioPage } from '@/features/inventario/inventario-page'
import { AjusteForm } from '@/features/inventario/inventario-forms'
import { ajusteSchema, minimoSchema } from '@/features/inventario/inventario-schema'
import { stockLabel } from '@/features/inventario/inventario-model'
import { adminUser, errorResponse, json, list, mockSupply, movimiento, renderWithSession, stock, writes } from './supply-fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function fillAdjustment() {
  await screen.findByRole('option', { name: /Bodega central/ })
  await screen.findByRole('option', { name: /Repuesto remoto/ })
  fireEvent.click(screen.getByRole('option', { name: /Bodega central/ }))
  fireEvent.click(screen.getByRole('option', { name: /Repuesto remoto/ }))
  for (const [label, value] of [['Cantidad del ajuste *', '4'], ['Motivo del ajuste *', ' Conteo físico ']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
describe('inventario HTTP', () => {
  it('solo admite ajustes con cantidad positiva SQL y motivo; mínimo permite cero', () => {
    const valid = { idBodega: '303', idRepuesto: '202', codigoTipoMovimiento: 'AJUSTE_SALIDA', cantidad: '4', observacion: 'Conteo' }
    expect(ajusteSchema.safeParse(valid).success).toBe(true)
    for (const patch of [{ cantidad: '0' }, { cantidad: '-1' }, { cantidad: '1.5' }, { cantidad: '2147483648' }, { observacion: ' ' }, { codigoTipoMovimiento: 'COMPRA_ENTRADA' }]) expect(ajusteSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
    expect(minimoSchema.parse({ stockMinimo: '0' })).toEqual({ stockMinimo: '0' })
    expect(minimoSchema.safeParse({ stockMinimo: '-1' }).success).toBe(false)
    expect([0, 2, 3].map(existencia => stockLabel({ existencia, stockMinimo: 2 }))).toEqual(['Sin stock', 'Igual o inferior al mínimo', 'Sobre el mínimo'])
  })
  it('GET filtros remotos correctos y paginación independiente de movimientos', async () => {
    const http = mockSupply(url => url.pathname.endsWith('/inventario/movimientos') ? json(list([movimiento], Number(url.searchParams.get('page')), 3)) : undefined)
    renderWithSession(<InventarioPage />)
    await screen.findByText(/AJ-505/)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente movimientos' }))
    await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes('/inventario/movimientos?') && String(url).includes('page=2'))).toBe(true))
    fireEvent.change(screen.getByLabelText('Situación de existencias'), { target: { value: 'true' } })
    fireEvent.change(screen.getByLabelText('Categoría (existencias)'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Tipo (movimientos)'), { target: { value: 'AJUSTE_SALIDA' } })
    fireEvent.change(screen.getByLabelText('ID de usuario (movimientos)'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Desde (movimientos)'), { target: { value: '2026-10-21' } })
    fireEvent.change(screen.getByLabelText('Hasta inclusive (movimientos)'), { target: { value: '2026-10-22' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes('/inventario?') && String(url).includes('bajoMinimo=true') && String(url).includes('idCategoria=1'))).toBe(true))
    await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes('/inventario/movimientos?') && String(url).includes('fechaDesde=2026-10-21') && String(url).includes('fechaHasta=2026-10-22') && String(url).includes('codigoTipoMovimiento=AJUSTE_SALIDA') && String(url).includes('idUsuario=9') && String(url).includes('page=1'))).toBe(true))
    expect(writes(http)).toHaveLength(0)
  })
  it('modifica mínimo con PATCH exacto y nunca edita existencia', async () => {
    const http = mockSupply(); renderWithSession(<InventarioPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mínimo de R202 en Bodega central' }))
    expect(screen.getByLabelText('Stock mínimo *')).toHaveValue('2')
    fireEvent.change(screen.getByLabelText('Stock mínimo *'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mínimo' }))
    await waitFor(() => expect(writes(http)).toHaveLength(1))
    expect(writes(http)[0][0]).toBe('/api/v1/inventario/303/202/stock-minimo')
    expect(writes(http)[0][1]?.method).toBe('PATCH'); expect(writes(http)[0][1]?.body).toBe('{"stockMinimo":0}')
    expect(screen.queryByRole('textbox', { name: /^existencia/i })).not.toBeInTheDocument()
  })
  it('ajuste POST con motivo, cantidades enteras, actor servidor e invalidaciones', async () => {
    const http = mockSupply(); const saved = vi.fn(); const { client } = renderWithSession(<AjusteForm onCancel={() => {}} onSaved={saved} />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await fillAdjustment()
    fireEvent.change(screen.getByLabelText('Tipo de ajuste *'), { target: { value: 'AJUSTE_SALIDA' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Ajustar inventario' }))
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(writes(http)[0][1]?.body))).toEqual({ idBodega: 303, idRepuesto: 202, codigoTipoMovimiento: 'AJUSTE_SALIDA', cantidad: 4, observacion: 'Conteo físico' })
    for (const resource of ['inventario', 'inventario/movimientos', 'compras', 'dashboard']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [resource] })
  })
  it.each([400, 409])('ajustes preservan campos y detalles %s', async status => {
    const http = mockSupply((_url, init) => init?.method === 'POST' ? errorResponse(status) : undefined)
    renderWithSession(<AjusteForm onCancel={() => {}} />); await fillAdjustment()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByText('observacion: Revisa el motivo.')).toBeVisible()
    expect(screen.getByLabelText('Motivo del ajuste *')).toHaveValue(' Conteo físico ')
    expect(screen.getByLabelText('Cantidad del ajuste *')).toHaveValue('4')
    expect(writes(http)).toHaveLength(1)
  })
  it('doble envío bloqueado, respuesta perdida no es éxito y no reintenta', async () => {
    let reject!: (reason: Error) => void
    const http = mockSupply((_url, init) => init?.method === 'POST' ? new Promise<Response>((_resolve, rejectPromise) => { reject = rejectPromise }) : undefined)
    const saved = vi.fn(); renderWithSession(<AjusteForm onCancel={() => {}} onSaved={saved} />); await fillAdjustment()
    const form = screen.getByRole('form', { name: 'Ajustar inventario' }); fireEvent.submit(form); fireEvent.submit(form)
    await waitFor(() => expect(writes(http)).toHaveLength(1))
    reject(new TypeError('offline'))
    expect(await screen.findByText(/Resultado no confirmado/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Registrar ajuste' })).toBeDisabled()
    fireEvent.submit(form); expect(writes(http)).toHaveLength(1); expect(saved).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Motivo del ajuste *')).toHaveValue(' Conteo físico ')
  })
  it('REPORTES_VER solo lee inventario y no ofrece ajustes ni mínimo', async () => {
    mockSupply(); renderWithSession(<InventarioPage />, { user: { ...adminUser, roles: ['CAJA'], permisos: ['REPORTES_VER'] } })
    await screen.findByText(/AJ-505/)
    expect(screen.queryByRole('button', { name: /Nuevo ajuste|Mínimo de/ })).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Existencias por bodega' })).toHaveTextContent(String(stock.existencia))
  })
})
