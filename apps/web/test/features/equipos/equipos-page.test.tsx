import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EquiposPage } from '@/features/equipos/equipos-page'
import { catalogos, cliente, equipo, json, list, mockHttp, renderFeature } from '../clientes/fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
beforeEach(() => { mockHttp() })
async function openForm() {
  const view = renderFeature(<EquiposPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }))
  await screen.findByRole('option', { name: 'Laptop' })
  await screen.findByRole('option', { name: 'Ana Pérez' })
  return view
}
function fill(label: RegExp, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
function select() { fill(/^Cliente propietario/, '11'); fill(/^Tipo de equipo/, '7'); fill(/^Marca/, '23') }
function text() { fill(/^Modelo/, ' Modelo de prueba '); fill(/^Número de serie/, ' SERIE-PRUEBA '); fill(/^Descripción/, ' Equipo con cargador ') }
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' })) }
const writes = (fetchMock: ReturnType<typeof mockHttp>) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH')

describe('Equipos operativo', () => {
  it.each(['', '   '])('valida modelo, serie y descripción requeridos %j', async value => {
    const fetchMock = mockHttp(); await openForm(); select()
    expect(screen.getByLabelText(/^Modelo/)).toHaveFocus()
    for (const label of [/^Modelo/, /^Número de serie/, /^Descripción/]) fill(label, value)
    submit()
    for (const [label, error] of [[/^Modelo/, 'Escribe el modelo.'], [/^Número de serie/, 'Escribe el número de serie.'], [/^Descripción/, 'Escribe la descripción del equipo.']] as const) {
      expect(await screen.findByText(error)).toBeVisible()
      expect(screen.getByLabelText(label)).toBeRequired()
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(error)
    }
    expect(writes(fetchMock)).toHaveLength(0)
    expect(screen.getByLabelText(/^Modelo/)).toHaveFocus()
  })

  it('requiere seleccionar propietario, tipo y marca recibidos sin IDs libres', async () => {
    await openForm(); text(); submit()
    for (const message of ['Selecciona un cliente propietario del catálogo disponible.', 'Selecciona un tipo de equipo del catálogo disponible.', 'Selecciona una marca del catálogo disponible.']) expect(await screen.findByText(message)).toBeVisible()
    for (const name of [/^Cliente propietario/, /^Tipo de equipo/, /^Marca/]) {
      expect(screen.getByRole('combobox', { name })).toBeRequired()
      expect(screen.getByRole('combobox', { name })).toHaveAttribute('aria-invalid', 'true')
    }
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('carga catálogos por HTTP sin perder el texto escrito y bloquea mientras espera', async () => {
    let resolve!: (response: Response) => void
    mockHttp(url => url.pathname.endsWith('/catalogos') ? new Promise<Response>(done => { resolve = done }) : undefined)
    renderFeature(<EquiposPage />); fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' })); text()
    expect(screen.getByRole('combobox', { name: /^Marca/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar equipo' })).toBeDisabled()
    expect(screen.getByText('Cargando tipos de equipo y marcas…')).toBeVisible()
    resolve(json({ data: catalogos }))
    await screen.findByRole('option', { name: 'Laptop' })
    expect(screen.getByLabelText(/^Modelo/)).toHaveValue(' Modelo de prueba ')
    expect(screen.getByRole('button', { name: 'Guardar equipo' })).toBeEnabled()
  })

  it.each(['marcas', 'tiposEquipo'] as const)('distingue catálogo %s vacío y bloquea envío', async field => {
    const fetchMock = mockHttp(url => url.pathname.endsWith('/catalogos') ? json({ data: { ...catalogos, [field]: [] } }) : undefined)
    renderFeature(<EquiposPage />); fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }))
    expect(await screen.findByText(new RegExp(`El catálogo recibido de ${field === 'marcas' ? 'marcas' : 'tipos de equipo'} no contiene opciones`))).toBeVisible()
    const input = screen.getByRole('combobox', { name: field === 'marcas' ? /^Marca/ : /^Tipo de equipo/ })
    expect(input).toBeDisabled(); expect(within(input).getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Guardar equipo' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form')); await waitFor(() => expect(writes(fetchMock)).toHaveLength(0))
  })

  it('reintenta solo lectura de catálogos después de error', async () => {
    let fail = true
    mockHttp(url => url.pathname.endsWith('/catalogos') ? fail ? json({ error: { code: 'ERROR', message: 'Catálogos no disponibles.' }, requestId: 'cat' }, 503) : json({ data: catalogos }) : undefined)
    renderFeature(<EquiposPage />); fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }))
    expect(await screen.findByText('Catálogos no disponibles.')).toBeVisible()
    fail = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }))
    expect(await screen.findByRole('option', { name: 'Laptop' })).toBeInTheDocument()
  })

  it('busca propietarios remotamente y conserva selección entre páginas y búsquedas', async () => {
    const otro = { ...cliente, idCliente: 222, nombreMostrar: 'Cliente página dos' }
    const fetchMock = mockHttp(url => url.pathname.endsWith('/clientes') ? json(list(url.searchParams.get('page') === '2' ? [otro] : [cliente], Number(url.searchParams.get('page')), 2)) : undefined)
    await openForm(); select(); text()
    fireEvent.click(screen.getByRole('button', { name: 'Más clientes' }))
    await screen.findByRole('option', { name: 'Cliente página dos' })
    expect(screen.getByRole('combobox', { name: /^Cliente propietario/ })).toHaveValue('11')
    fill(/^Cliente propietario/, '222')
    fill(/^Buscar cliente propietario/, 'remoto')
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('search=remoto') && String(url).includes('page=1'))).toBe(true))
    expect(screen.getByRole('combobox', { name: /^Cliente propietario/ })).toHaveValue('222')
    expect(screen.getByRole('option', { name: 'Cliente página dos' })).toBeInTheDocument()
    submit(); expect(await screen.findByText('Equipo guardado correctamente.')).toBeVisible()
    expect(JSON.parse(String(writes(fetchMock)[0][1]?.body)).idCliente).toBe(222)
  })

  it('POST envía solo DTO numérico y recortado, invalida listas y dashboard', async () => {
    const fetchMock = mockHttp(); const { client } = await openForm(); const invalidate = vi.spyOn(client, 'invalidateQueries')
    select(); text(); submit()
    expect(await screen.findByText('Equipo guardado correctamente.')).toBeVisible()
    expect(writes(fetchMock)).toHaveLength(1)
    expect(writes(fetchMock)[0][1]?.method).toBe('POST')
    expect(JSON.parse(String(writes(fetchMock)[0][1]?.body))).toEqual({ idCliente: 11, idTipoEquipo: 7, idMarca: 23, modelo: 'Modelo de prueba', numeroSerie: 'SERIE-PRUEBA', descripcion: 'Equipo con cargador', estado: 'ACTIVO' })
    for (const key of ['equipos', 'clientes', 'dashboard']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
    expect(screen.getByRole('button', { name: 'Nuevo equipo' })).toHaveFocus()
  })

  it('PATCH precarga propietario aunque no esté en página actual y conserva conflicto 409', async () => {
    const fetchMock = mockHttp((url, init) => init?.method === 'PATCH' ? json({ error: { code: 'EQUIPO_CON_ORDENES', message: 'No se puede cambiar el propietario de un equipo con órdenes.' }, requestId: 'owner' }, 409) : url.pathname.endsWith('/clientes') ? json(list([{ ...cliente, idCliente: 222, nombreMostrar: 'Otro cliente' }])) : undefined)
    renderFeature(<EquiposPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar SERIE-PRUEBA' }))
    await screen.findByRole('option', { name: 'Laptop' })
    expect(screen.getByRole('combobox', { name: /^Cliente propietario/ })).toHaveValue('11')
    expect(screen.getByRole('combobox', { name: /^Tipo de equipo/ })).toHaveValue('7')
    expect(screen.getByRole('combobox', { name: /^Marca/ })).toHaveValue('23')
    await screen.findByRole('option', { name: 'Otro cliente' })
    fill(/^Cliente propietario/, '222'); submit()
    expect(await screen.findByText('No se puede cambiar el propietario de un equipo con órdenes.')).toBeVisible()
    expect(screen.getByRole('combobox', { name: /^Cliente propietario/ })).toHaveValue('222')
    expect(screen.getByLabelText(/^Modelo/)).toHaveValue(equipo.modelo)
    expect(writes(fetchMock)).toHaveLength(1)
    expect(writes(fetchMock)[0][0]).toContain('/equipos/31')
    expect(writes(fetchMock)[0][1]?.method).toBe('PATCH')
    expect(writes(fetchMock)[0][1]?.body).not.toContain('clienteNombre')
    expect(screen.queryByText('Equipo guardado correctamente.')).not.toBeInTheDocument()
  })

  it.each(['errores', 'error HTTP'])('cancelar limpia datos y selecciones tras %s y restaura foco', async state => {
    mockHttp((_url, init) => init?.method === 'POST' ? json({ error: { code: 'ERROR', message: 'Serie duplicada.' }, requestId: 'serie' }, 409) : undefined)
    await openForm(); select(); text(); if (state === 'errores') fill(/^Modelo/, ' ')
    submit(); expect(await screen.findByText(state === 'errores' ? 'Escribe el modelo.' : 'Serie duplicada.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Nuevo equipo' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }))
    for (const name of [/^Cliente propietario/, /^Tipo de equipo/, /^Marca/]) expect(screen.getByRole('combobox', { name })).toHaveValue('')
    for (const label of [/^Modelo/, /^Número de serie/, /^Descripción/]) { expect(screen.getByLabelText(label)).toHaveValue(''); expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'false') }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('PATCH guarda estado sin transferir propietario si no puede consultar clientes', async () => {
    const fetchMock = mockHttp(); renderFeature(<EquiposPage />, ['EQUIPOS_GESTIONAR'])
    fireEvent.click(await screen.findByRole('button', { name: 'Editar SERIE-PRUEBA' }))
    await screen.findByRole('option', { name: 'Laptop' })
    expect(screen.getByRole('combobox', { name: /^Cliente propietario/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Estado del equipo'), { target: { value: 'BAJA' } })
    fill(/^Modelo/, 'Actualizado'); submit()
    expect(await screen.findByText('Equipo guardado correctamente.')).toBeVisible()
    expect(JSON.parse(String(writes(fetchMock)[0][1]?.body))).toMatchObject({ idCliente: 11, modelo: 'Actualizado', estado: 'BAJA' })
    expect(writes(fetchMock)[0][1]?.method).toBe('PATCH')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar SERIE-PRUEBA' })).toHaveFocus())
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/clientes'))).toBe(false)
  })

  it('bloquea doble POST y preserva datos ante respuesta ambigua', async () => {
    let resolve!: (response: Response) => void
    const fetchMock = mockHttp((_url, init) => init?.method === 'POST' ? new Promise<Response>(done => { resolve = done }) : undefined)
    await openForm(); select(); text()
    fireEvent.submit(screen.getByRole('form')); fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    resolve(json({ error: { code: 'ERROR', message: 'Respuesta interrumpida.' }, requestId: 'amb' }, 503))
    expect(await screen.findByText(/Consulta el listado antes de volver a enviar/)).toBeVisible()
    expect(screen.getByLabelText(/^Modelo/)).toHaveValue(' Modelo de prueba ')
    expect(writes(fetchMock)).toHaveLength(1)
  })

  it('GET usa serie/modelo, estado, propietario y paginación remotos', async () => {
    const fetchMock = mockHttp(url => url.pathname.endsWith('/equipos') ? json(list([equipo], Number(url.searchParams.get('page')), 3)) : undefined)
    renderFeature(<EquiposPage />); await screen.findByText('SERIE-PRUEBA')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/equipos?page=2'))).toBe(true))
    fill(/^Buscar equipos/, 'SERIE')
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'BAJA' } })
    await screen.findByRole('option', { name: 'Ana Pérez' }); fill(/^Cliente propietario/, '11')
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/equipos?page=1') && String(url).includes('search=SERIE') && String(url).includes('estado=BAJA') && String(url).includes('idCliente=11'))).toBe(true))
  })

  it('respeta lectura amplia, desactiva selector sin permisos y no usa rol como bypass', async () => {
    const fetchMock = mockHttp(); const view = renderFeature(<EquiposPage />, ['EQUIPOS_GESTIONAR'])
    await screen.findByText('SERIE-PRUEBA')
    expect(screen.getByRole('combobox', { name: /^Cliente propietario/ })).toBeDisabled()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/clientes'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' })); await screen.findByRole('option', { name: 'Laptop' })
    expect(screen.getByRole('button', { name: 'Guardar equipo' })).toBeDisabled()
    expect(screen.getByText(/No tienes permiso para consultar clientes/)).toBeVisible()
    view.unmount(); fetchMock.mockClear()
    const read = renderFeature(<EquiposPage />, ['DIAGNOSTICO_REGISTRAR']); await screen.findByText('SERIE-PRUEBA')
    expect(screen.queryByRole('button', { name: /Nuevo equipo|Editar/ })).not.toBeInTheDocument()
    read.unmount(); fetchMock.mockClear()
    renderFeature(<EquiposPage />, ['PAGOS_REGISTRAR'])
    expect(screen.getByText('Acceso restringido')).toBeVisible(); expect(fetchMock).not.toHaveBeenCalled()
  })

  it('muestra vacío y error con reintento de listado y selector', async () => {
    let fail = true
    mockHttp(url => url.pathname.endsWith('/equipos') || url.pathname.endsWith('/clientes') ? fail ? json({ error: { code: 'ERROR', message: 'Lectura fallida.' }, requestId: 'get' }, 503) : json(list([])) : undefined)
    renderFeature(<EquiposPage />)
    await waitFor(() => expect(screen.getAllByText('Lectura fallida.')).toHaveLength(2))
    fail = false; for (const button of screen.getAllByRole('button', { name: 'Reintentar consulta' })) fireEvent.click(button)
    expect(await screen.findByText('Sin equipos para estos filtros')).toBeVisible()
    expect(await screen.findByText('Sin clientes para esta búsqueda.')).toBeVisible()
  })
})
