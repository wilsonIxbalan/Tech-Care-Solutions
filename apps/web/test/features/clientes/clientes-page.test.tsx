import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientesPage } from '@/features/clientes/clientes-page'
import { cliente, json, list, mockHttp, renderFeature } from './fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
beforeEach(() => { mockHttp() })
function openForm() { const view = renderFeature(<ClientesPage />); fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' })); return view }
function fill(label: RegExp, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
function type(value: string) { fireEvent.change(screen.getByLabelText(/Tipo de cliente/), { target: { value } }) }
function valid() { fill(/^Nombres/, ' Ana '); fill(/^Apellidos/, ' Pérez '); fill(/^NIT/, ' CF '); fill(/^Teléfono/, '22223333') }
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' })) }
const writes = (fetchMock: ReturnType<typeof mockHttp>) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH')

describe('Clientes operativo', () => {
  it.each(['', '   '])('valida requeridos individuales %j con errores accesibles y foco', async value => {
    const fetchMock = mockHttp(); openForm()
    expect(screen.getByLabelText(/Tipo de cliente/)).toHaveFocus()
    for (const label of [/^Nombres/, /^Apellidos/, /^NIT/, /^Teléfono/]) fill(label, value)
    submit()
    for (const [label, error] of [[/^Nombres/, 'Escribe los nombres.'], [/^Apellidos/, 'Escribe los apellidos.'], [/^NIT/, 'Escribe el NIT.'], [/^Teléfono/, 'Escribe el teléfono.']] as const) {
      expect(await screen.findByText(error)).toBeVisible()
      expect(screen.getByLabelText(label)).toBeRequired()
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(new RegExp(error))
    }
    expect(writes(fetchMock)).toHaveLength(0)
    expect(screen.getByLabelText(/^Nombres/)).toHaveFocus()
  })

  it.each(['', '   '])('valida requeridos empresariales %j', async value => {
    openForm(); type('EMPRESARIAL')
    for (const label of [/^Razón social/, /^NIT/, /^Teléfono/]) fill(label, value)
    submit()
    expect(await screen.findByText('Escribe la razón social.')).toBeVisible()
    expect(screen.getByLabelText(/^Razón social/)).toHaveAccessibleDescription(/Escribe la razón social\./)
    expect(screen.getByText('Escribe el NIT.')).toBeVisible()
    expect(screen.getByText('Escribe el teléfono.')).toBeVisible()
    expect(screen.getByLabelText('Nombre de contacto')).not.toBeRequired()
  })

  it('cambia tipo, conserva comunes y limpia campos que dejan de corresponder', async () => {
    openForm(); valid(); fill(/^Correo electrónico/, 'contacto@example.test'); fill(/^Dirección/, 'Zona 1')
    type('EMPRESARIAL')
    expect(screen.queryByLabelText(/^Nombres/)).not.toBeInTheDocument()
    fill(/^Razón social/, 'Empresa'); fill(/^Nombre de contacto/, 'Ana')
    type('INDIVIDUAL')
    expect(screen.getByLabelText(/^Nombres/)).toHaveValue('')
    expect(screen.getByLabelText(/^Apellidos/)).toHaveValue('')
    expect(screen.getByLabelText(/^NIT/)).toHaveValue(' CF ')
    expect(screen.getByLabelText(/^Teléfono/)).toHaveValue('22223333')
    expect(screen.getByLabelText(/^Correo electrónico/)).toHaveValue('contacto@example.test')
    expect(screen.getByLabelText(/^Dirección/)).toHaveValue('Zona 1')
    submit(); expect(await screen.findByText('Escribe los nombres.')).toBeVisible()
    type('EMPRESARIAL')
    expect(screen.queryByText('Escribe los nombres.')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Razón social/)).toHaveValue('')
    expect(screen.getByLabelText(/^Nombre de contacto/)).toHaveValue('')
  })

  it.each(['', '   '])('POST normaliza correo opcional %j a null y envía solo DTO', async email => {
    const fetchMock = mockHttp(); const { client } = openForm(); const invalidate = vi.spyOn(client, 'invalidateQueries')
    valid(); fill(/^Correo electrónico/, email); submit()
    expect(await screen.findByText('Cliente guardado correctamente.')).toBeVisible()
    expect(writes(fetchMock)).toHaveLength(1)
    expect(JSON.parse(String(writes(fetchMock)[0][1]?.body))).toEqual({ tipoCliente: 'INDIVIDUAL', nombres: 'Ana', apellidos: 'Pérez', razonSocial: null, nombreContacto: null, nit: 'CF', telefono: '22223333', email: null, direccion: null, estado: 'ACTIVO' })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['clientes'] })
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toHaveFocus()
  })

  it('valida email y permite corregirlo antes de guardar', async () => {
    const fetchMock = mockHttp(); openForm(); valid(); fill(/^Correo electrónico/, 'invalido'); submit()
    expect(await screen.findByText('Escribe un correo válido.')).toBeVisible()
    expect(screen.getByLabelText(/^Correo electrónico/)).toHaveAccessibleDescription(/Escribe un correo válido\./)
    expect(writes(fetchMock)).toHaveLength(0)
    fill(/^Correo electrónico/, 'contacto@example.test')
    await waitFor(() => expect(screen.queryByText('Escribe un correo válido.')).not.toBeInTheDocument())
    submit(); expect(await screen.findByText('Cliente guardado correctamente.')).toBeVisible()
  })

  it('cancelar limpia errores, tipo y valores, y restaura foco', async () => {
    openForm(); type('EMPRESARIAL'); fill(/^NIT/, 'CF'); fill(/^Nombre de contacto/, 'Ana'); submit()
    expect(await screen.findByText('Escribe la razón social.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    expect(screen.getByLabelText(/Tipo de cliente/)).toHaveValue('INDIVIDUAL')
    for (const label of [/^Nombres/, /^Apellidos/, /^NIT/, /^Teléfono/, /^Correo electrónico/, /^Dirección/]) {
      expect(screen.getByLabelText(label)).toHaveValue('')
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'false')
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    type('EMPRESARIAL'); expect(screen.getByLabelText(/^Nombre de contacto/)).toHaveValue('')
  })

  it('PATCH precarga, convierte empresa y no envía derivados', async () => {
    const fetchMock = mockHttp(); renderFeature(<ClientesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana Pérez' }))
    expect(screen.getByLabelText(/^Nombres/)).toHaveValue('Ana')
    type('EMPRESARIAL'); fill(/^Razón social/, ' Empresa '); submit()
    expect(await screen.findByText('Cliente guardado correctamente.')).toBeVisible()
    const [url, init] = writes(fetchMock)[0]
    expect(url).toContain('/clientes/11'); expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toMatchObject({ nombres: null, apellidos: null, razonSocial: 'Empresa', nombreContacto: null })
    expect(init?.body).not.toContain('nombreMostrar')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar Ana Pérez' })).toHaveFocus())
  })

  it('conserva formulario y detalles 409 sin éxito falso ni repetición', async () => {
    const fetchMock = mockHttp((_url, init) => init?.method === 'POST' ? json({ error: { code: 'CONFLICTO', message: 'NIT duplicado.', details: { nit: ['Ya está registrado.'] } }, requestId: 'req-1' }, 409) : undefined)
    openForm(); valid(); submit()
    expect(await screen.findByText('NIT duplicado.')).toBeVisible()
    expect(screen.getByText('nit: Ya está registrado.')).toBeVisible()
    expect(screen.getByText('Referencia: req-1')).toBeVisible()
    expect(screen.getByLabelText(/^Nombres/)).toHaveValue(' Ana ')
    expect(writes(fetchMock)).toHaveLength(1)
    expect(screen.queryByText('Cliente guardado correctamente.')).not.toBeInTheDocument()
  })

  it('bloquea doble envío y avisa respuesta ambigua sin reintento', async () => {
    let reject!: (error: Error) => void
    const fetchMock = mockHttp((_url, init) => init?.method === 'POST' ? new Promise<Response>((_resolve, rejectPromise) => { reject = rejectPromise }) : undefined)
    openForm(); valid()
    fireEvent.submit(screen.getByRole('form')); fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    reject(new TypeError('offline'))
    expect(await screen.findByText(/Consulta el listado antes de volver a enviar/)).toBeVisible()
    expect(writes(fetchMock)).toHaveLength(1)
    expect(screen.getByLabelText(/^Nombres/)).toHaveValue(' Ana ')
  })

  it('GET paginado, búsqueda y estado remotos reinician página', async () => {
    const fetchMock = mockHttp(url => url.pathname.endsWith('/clientes') ? json(list([cliente], Number(url.searchParams.get('page')), 3)) : undefined)
    renderFeature(<ClientesPage />)
    await screen.findByText('Ana Pérez')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true))
    fill(/^Buscar clientes/, 'Ana')
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'INACTIVO' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('page=1') && String(url).includes('search=Ana') && String(url).includes('estado=INACTIVO'))).toBe(true))
  })

  it('permite lectura amplia sin gestión y no solicita nada sin permisos', async () => {
    const fetchMock = mockHttp(); const view = renderFeature(<ClientesPage />, ['PAGOS_REGISTRAR'])
    expect(await screen.findByText('Ana Pérez')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Nuevo cliente|Editar/ })).not.toBeInTheDocument()
    view.unmount(); fetchMock.mockClear()
    renderFeature(<ClientesPage />, [])
    expect(screen.getByText('Acceso restringido')).toBeVisible(); expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lecturas muestran error y permiten reintentar hasta vacío', async () => {
    let fail = true
    mockHttp(url => url.pathname.endsWith('/clientes') ? fail ? json({ error: { code: 'ERROR', message: 'No disponible.' }, requestId: 'read' }, 503) : json(list([])) : undefined)
    renderFeature(<ClientesPage />)
    expect(await screen.findByText('No disponible.')).toBeVisible()
    fail = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }))
    expect(await screen.findByText('Sin clientes para estos filtros')).toBeVisible()
  })
})
