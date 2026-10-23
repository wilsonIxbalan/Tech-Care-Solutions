import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EquiposPage } from '@/features/equipos/equipos-page'
import type { EquipoCatalogos } from '@/features/equipos/equipo-catalogos'

const catalogos = {
  clientes: [{ idCliente: 11, nombreMostrar: 'Cliente de prueba' }],
  tiposEquipo: [{ idTipoEquipo: 7, nombre: 'Tipo de prueba' }],
  marcas: [{ idMarca: 23, nombre: 'Marca de prueba' }],
} satisfies EquipoCatalogos

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function openForm(data?: EquipoCatalogos) {
  const view = render(<EquiposPage catalogos={data} />)
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }))
  return view
}

function fillField(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function selectCatalogs() {
  fillField(/^Cliente propietario/, '11')
  fillField(/^Tipo de equipo/, '7')
  fillField(/^Marca/, '23')
}

function fillTextFields() {
  fillField(/^Modelo/, 'Modelo de prueba')
  fillField(/^Número de serie \*/, 'SERIE-PRUEBA')
  fillField(/^Descripción/, 'Descripción de prueba')
}

function validate() {
  fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
}

describe('formulario de Equipos', () => {
  it.each(['', '   '])('rechaza modelo y serie obligatorios con valor %j', async value => {
    openForm(catalogos)
    selectCatalogs()
    fillField(/^Modelo/, value)
    fillField(/^Número de serie \*/, value)
    validate()

    expect(await screen.findByText('Escribe el modelo.')).toBeVisible()
    expect(screen.getByText('Escribe el número de serie.')).toBeVisible()
    for (const [label, error] of [[/^Modelo/, 'Escribe el modelo.'], [/^Número de serie \*/, 'Escribe el número de serie.']] as const) {
      expect(screen.getByLabelText(label)).toBeRequired()
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(error)
    }
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('requiere seleccionar cliente, tipo y marca sin escribir identificadores', async () => {
    openForm(catalogos)
    fillTextFields()
    validate()

    expect(await screen.findByText('Selecciona un cliente propietario del catálogo disponible.')).toBeVisible()
    expect(screen.getByText('Selecciona un tipo de equipo del catálogo disponible.')).toBeVisible()
    expect(screen.getByText('Selecciona una marca del catálogo disponible.')).toBeVisible()
    for (const name of [/Cliente propietario/, /Tipo de equipo/, /Marca/]) {
      expect(screen.getByRole('combobox', { name })).toBeRequired()
      expect(screen.getByRole('combobox', { name })).toHaveAttribute('aria-invalid', 'true')
    }
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('muestra catálogos pendientes sin opciones inventadas y bloquea la validación completa', async () => {
    openForm()
    fillTextFields()

    expect(screen.getByText('Catálogo de clientes pendiente de conexión.')).toBeVisible()
    expect(screen.getByText('Catálogo de tipos de equipo pendiente de conexión.')).toBeVisible()
    expect(screen.getByText('Catálogo de marcas pendiente de conexión.')).toBeVisible()
    for (const select of screen.getAllByRole('combobox')) {
      expect(select).toBeDisabled()
      expect(within(select).getAllByRole('option')).toHaveLength(1)
      expect(select).toHaveValue('')
    }
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toHaveAccessibleDescription(/La validación completa está bloqueada/)

    // También bloquea un envío por teclado o un submit sin pulsar el botón.
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar equipo' }))
    expect(await screen.findByText('Selecciona un cliente propietario del catálogo disponible.')).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['clientes', 'tiposEquipo', 'marcas'] as const)('bloquea el formulario si solo falta el catálogo %s', field => {
    openForm({ ...catalogos, [field]: undefined })
    expect(screen.getAllByRole('combobox').filter(select => select.hasAttribute('disabled'))).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('distingue un catálogo recibido vacío de uno pendiente de conexión', () => {
    openForm({ ...catalogos, marcas: [] })
    expect(screen.getByText('El catálogo recibido de marcas no contiene opciones.')).toBeVisible()
    expect(screen.queryByText('Catálogo de marcas pendiente de conexión.')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Marca/ })).toBeDisabled()
    expect(within(screen.getByRole('combobox', { name: /Marca/ })).getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
  })

  it('acepta catálogos recibidos después de abrir el formulario y permite validar', async () => {
    const view = openForm()
    fillTextFields()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    view.rerender(<EquiposPage catalogos={catalogos} />)

    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeEnabled()
    for (const name of ['Cliente de prueba', 'Tipo de prueba', 'Marca de prueba']) {
      expect(screen.getByRole('option', { name })).toBeInTheDocument()
    }
    selectCatalogs()
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('El equipo aún no se ha guardado: falta conectar la API.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['errores', 'validación correcta'])('cancelar limpia campos, selecciones y mensajes tras %s', async state => {
    openForm(catalogos)
    selectCatalogs()
    fillTextFields()
    if (state === 'errores') fillField(/^Modelo/, '   ')
    validate()
    if (state === 'errores') expect(await screen.findByText('Escribe el modelo.')).toBeVisible()
    else expect(await screen.findByRole('status')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }))

    for (const select of screen.getAllByRole('combobox')) expect(select).toHaveValue('')
    for (const label of [/^Modelo/, /^Número de serie \*/, /^Descripción/]) {
      expect(screen.getByLabelText(label)).toHaveValue('')
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'false')
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('retira el mensaje anterior al editar y valida sin red ni persistencia', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    openForm(catalogos)
    selectCatalogs()
    fillTextFields()
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('Los datos son válidos.')

    fillField(/^Modelo/, '   ')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    validate()
    expect(await screen.findByText('Escribe el modelo.')).toBeVisible()
    fillField(/^Modelo/, 'Otro modelo de prueba')
    await waitFor(() => expect(screen.queryByText('Escribe el modelo.')).not.toBeInTheDocument())
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('El equipo aún no se ha guardado')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(xhrSend).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Consulta de equipos pendiente de conexión' })).toBeVisible()
  })

  it('prepara la búsqueda por serie sin consultar ni presentar resultados', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    render(<EquiposPage />)
    const search = screen.getByRole('searchbox', { name: 'Número de serie para historial' })
    fireEvent.change(search, { target: { value: 'SERIE-PRUEBA' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }))

    expect(search).toHaveValue('SERIE-PRUEBA')
    expect(search).toHaveAccessibleDescription(/Todavía no se ha realizado ninguna búsqueda/)
    expect(screen.getByRole('button', { name: 'Consultar historial' })).toBeDisabled()
    expect(screen.queryByText(/sin resultados/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
  })
})
