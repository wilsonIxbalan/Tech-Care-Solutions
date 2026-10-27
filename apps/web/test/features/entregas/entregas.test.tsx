import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EntregasPage } from '@/features/entregas/entregas-page'
import { EntregaForm } from '@/features/entregas/entrega-form'
import { createEntregaSchema, permiteBorradorEntrega, type OrdenEntrega } from '@/features/entregas/entrega-schema'
import { renderWithSession, json } from '../../support/session'
import { orden, factura, list, urlOf, failure, tecnico } from '../ordenes/service-fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const listo = { ...orden, estado: 'LISTO' as const, factura }
const valid = { idOrden: '21', nombreRecibe: 'Receptor de prueba', documentoRecibe: '', observaciones: '' }
describe('entregas reales', () => {
  it('exige relación, factura vigente, estado y saldo verificables; conserva validaciones de receptor/documento', () => {
    expect(permiteBorradorEntrega(listo)).toBe(true)
    for (const patch of [{ factura: undefined }, { factura: null }, { estado: 'REPARACION' as const }, { factura: { ...factura, estado: 'ANULADA' as const } }, { factura: { ...factura, idOrden: 9 } }, { factura: { ...factura, saldo: '0.01' } }, { factura: { ...factura, saldo: '0' } }]) {
      expect(permiteBorradorEntrega({ ...listo, ...patch })).toBe(false)
      expect(createEntregaSchema([{ ...listo, ...patch }]).safeParse(valid).success).toBe(false)
    }
    const schema = createEntregaSchema([listo])
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, nombreRecibe: ' ' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, documentoRecibe: 'x'.repeat(31) }).success).toBe(false)
  })
  it.each([
    { ...listo, factura: null }, { ...listo, factura: { ...factura, saldo: '0.01' } },
    { ...listo, factura: { ...factura, estado: 'ANULADA' as const } }, { ...listo, estado: 'REPARACION' as const },
  ])('bloquea requisitos de entrega incumplidos sin enviar POST', async (order: OrdenEntrega) => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<EntregaForm orden={order} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre de quien recibe *'), { target: { value: 'Receptor' } })
    expect(screen.getByRole('button', { name: 'Revisar entrega' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(fetcher).not.toHaveBeenCalled())
  })
  it('selecciona orden real, consulta detalle y confirma JSON de entrega una sola vez', async () => {
    let delivered = false
    const entrega = { idEntrega: 101, idOrden: 21, idUsuarioEntrega: 1, usuarioEntregaNombre: 'Recepción', nombreRecibe: 'Receptor', documentoRecibe: null, fechaEntrega: '2026-10-26T16:00:00.000Z', observaciones: null }
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') { delivered = true; return json({ data: { idEntrega: 101, idOrden: 21, estadoOrden: 'ENTREGADO' } }) }
      if (urlOf(input).pathname.endsWith('/21')) return json({ data: delivered ? { ...listo, estado: 'ENTREGADO', entrega } : listo })
      return list(delivered ? [] : [listo])
    })
    vi.stubGlobal('fetch', fetcher)
    const { client } = renderWithSession(<EntregasPage />)
    const invalidations = vi.spyOn(client, 'invalidateQueries')
    await screen.findByRole('option', { name: /OS-0021/ })
    fireEvent.change(screen.getByLabelText('Orden para entrega *'), { target: { value: '21' } })
    await screen.findByRole('form', { name: 'Confirmar entrega' })
    fireEvent.change(screen.getByLabelText('Nombre de quien recibe *'), { target: { value: '  Receptor  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar entrega' }))
    await screen.findByRole('button', { name: 'Confirmar operación' })
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    fireEvent.submit(screen.getByRole('form', { name: 'Confirmar entrega' }))
    fireEvent.submit(screen.getByRole('form', { name: 'Confirmar entrega' }))
    expect(await screen.findByRole('heading', { name: 'Entrega registrada' })).toBeVisible()
    const posts = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('/api/v1/ordenes/21/entrega')
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ nombreRecibe: 'Receptor', documentoRecibe: null, observaciones: null })
    expect(invalidations).toHaveBeenCalledWith({ queryKey: ['caja'] })
    expect(invalidations).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })
  it.each([400, 409])('conserva receptor y documento al fallar con %s sin reintentar', async status => {
    const fetcher = vi.fn(() => failure(status, status === 400 ? { nombreRecibe: ['Revisa el receptor.'] } : undefined))
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<EntregaForm orden={listo} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre de quien recibe *'), { target: { value: 'Receptor' } })
    fireEvent.change(screen.getByLabelText('Documento de quien recibe'), { target: { value: '001234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar operación' }))
    await screen.findByText(status === 400 ? 'Revisa los campos.' : 'El estado ha cambiado.')
    expect(screen.getByLabelText('Nombre de quien recibe *')).toHaveValue('Receptor')
    expect(screen.getByLabelText('Documento de quien recibe')).toHaveValue('001234')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('sin ENTREGAR_ORDEN no ofrece la acción ni consulta datos', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<EntregaForm orden={listo} onCancel={vi.fn()} />, { user: { ...tecnico, permisos: ['REPARACION_GESTIONAR'] } })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
