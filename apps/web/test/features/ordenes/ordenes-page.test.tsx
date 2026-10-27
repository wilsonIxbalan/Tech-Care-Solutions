import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import { OrdenesPage } from '@/features/ordenes/ordenes-page'
import { OrdenForm } from '@/features/ordenes/orden-form'
import { OrdenDetallePage } from '@/features/ordenes/orden-detalle-page'
import { renderWithSession, json } from '../../support/session'
import { catalogos, orden, list, urlOf, failure, tecnico, factura } from './service-fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const cliente = { idCliente: 11, nombreMostrar: 'Cliente seleccionado', estado: 'ACTIVO' }
const equipo = { idEquipo: 41, idCliente: 11, modelo: 'Modelo de prueba', numeroSerie: 'SERIE-0041', estado: 'ACTIVO' }
function mockCreation(post: (body: unknown) => Response | Promise<Response>) {
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input)
    if (init?.method === 'POST') return post(JSON.parse(String(init.body)))
    if (url.pathname.endsWith('/catalogos')) return json({ data: catalogos })
    if (url.pathname.endsWith('/clientes')) return list(url.searchParams.get('page') === '2' ? [cliente] : [], Number(url.searchParams.get('page')), 2)
    if (url.pathname.endsWith('/equipos')) return list(url.searchParams.get('page') === '2' ? [equipo] : [], Number(url.searchParams.get('page')), 2)
    throw new Error(`Unexpected request: ${input}`)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
async function fillCreation() {
  await screen.findByRole('option', { name: 'Urgente' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cliente: siguientes' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Cliente: siguientes' }))
  await screen.findByRole('option', { name: 'Cliente seleccionado' })
  fireEvent.change(screen.getByLabelText('Cliente *'), { target: { value: '11' } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Equipo: siguientes' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Equipo: siguientes' }))
  await screen.findByRole('option', { name: /SERIE-0041/ })
  fireEvent.change(screen.getByLabelText('Equipo *'), { target: { value: '41' } })
  fireEvent.change(screen.getByLabelText('Prioridad *'), { target: { value: '7' } })
  fireEvent.change(screen.getByLabelText('Problema reportado *'), { target: { value: '  No enciende  ' } })
}
describe('órdenes conectadas', () => {
  it('consulta filtros y páginas remotas y enlaza el detalle sin datos ficticios', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => urlOf(input).pathname.endsWith('/catalogos') ? json({ data: catalogos }) : list([orden], Number(urlOf(input).searchParams.get('page')), 2))
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<OrdenesPage />)
    expect(await screen.findByRole('link', { name: orden.numeroOrden })).toHaveAttribute('href', '/ordenes/21')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => urlOf(input).searchParams.get('page') === '2')).toBe(true))
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'REPARACION' } })
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => urlOf(input).searchParams.get('estado') === 'REPARACION' && urlOf(input).searchParams.get('page') === '1')).toBe(true))
    fireEvent.change(screen.getByLabelText('Buscar orden'), { target: { value: 'SERIE' } })
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => urlOf(input).searchParams.get('search') === 'SERIE')).toBe(true))
  })
  it('crea OrdenInput con selección en segunda página, JSON y sin actor ni estado; protege doble submit', async () => {
    let resolve!: (response: Response) => void
    const fetcher = mockCreation(() => new Promise<Response>(done => { resolve = done }))
    const onCreated = vi.fn()
    const { client } = renderWithSession(<OrdenForm onCancel={vi.fn()} onCreated={onCreated} />)
    const invalidations = vi.spyOn(client, 'invalidateQueries')
    await fillCreation()
    const form = screen.getByRole('form', { name: 'Recepción de orden' })
    fireEvent.submit(form); fireEvent.submit(form)
    await waitFor(() => expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1))
    const [input, init] = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(String(input)).toBe('/api/v1/ordenes')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual({ idCliente: 11, idEquipo: 41, idPrioridad: 7, problemaReportado: 'No enciende', fechaEstimada: null, observaciones: null })
    expect(fetcher.mock.calls.some(([input]) => urlOf(input).pathname.endsWith('/equipos') && urlOf(input).searchParams.get('idCliente') === '11')).toBe(true)
    resolve(json({ data: { idOrden: 21, numeroOrden: 'OS-0021', estado: 'RECIBIDO' } }, 201))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(21))
    expect(invalidations).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })
  it.each([400, 409])('conserva formulario y selecciones en error %s sin reintentar', async status => {
    const fetcher = mockCreation(() => failure(status, status === 400 ? { problemaReportado: ['Describe la falla.'] } : undefined))
    renderWithSession(<OrdenForm onCancel={vi.fn()} />)
    await fillCreation()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar orden' }))
    await screen.findByText(status === 400 ? 'Revisa los campos.' : 'El estado ha cambiado.')
    expect(screen.getByLabelText('Problema reportado *')).toHaveValue('  No enciende  ')
    expect(screen.getByLabelText('Equipo *')).toHaveValue('41')
    if (status === 400) expect(screen.getByLabelText('Problema reportado *')).toHaveAccessibleDescription('Describe la falla.')
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })
  it('restringe creación por permiso y muestra vacío/error con reconsulta explícita', async () => {
    let fails = true
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => urlOf(input).pathname.endsWith('/catalogos') ? json({ data: catalogos }) : fails ? failure(503) : list([])))
    renderWithSession(<OrdenesPage />, { user: { ...tecnico, permisos: ['DIAGNOSTICO_REGISTRAR'] } })
    expect(screen.queryByRole('button', { name: 'Nueva orden' })).not.toBeInTheDocument()
    await screen.findByText('El estado ha cambiado.')
    fails = false
    fireEvent.click(screen.getByRole('button', { name: /intentar/i }))
    expect(await screen.findByRole('heading', { name: 'Sin órdenes' })).toBeVisible()
  })
  it('carga detalle, historial, factura existente y transición sin asumir estados de éxito', async () => {
    const orderReady = { ...orden, estado: 'LISTO', factura }
    const fetcher = vi.fn((input: RequestInfo | URL) => urlOf(input).pathname.endsWith('/catalogos') ? json({ data: catalogos }) : urlOf(input).pathname.endsWith('/21') ? json({ data: orderReady }) : list([orden]))
    vi.stubGlobal('fetch', fetcher)
    renderWithSession(<Routes><Route path="/" element={<OrdenesPage />} /><Route path="/ordenes/:id" element={<OrdenDetallePage />} /></Routes>)
    fireEvent.click(await screen.findByRole('link', { name: 'OS-0021' }))
    expect(await screen.findByRole('heading', { name: 'OS-0021' })).toBeVisible()
    expect(within(screen.getByRole('table', { name: 'Historial de estados' })).getByText('Equipo recibido')).toBeVisible()
    expect(screen.getByText('FAC-0071 · PAGADA')).toBeVisible()
    expect(screen.queryByRole('form', { name: 'Cambiar estado de orden' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeVisible()
    expect(fetcher.mock.calls.some(([input]) => String(input).endsWith('/ordenes/21'))).toBe(true)
  })
})
