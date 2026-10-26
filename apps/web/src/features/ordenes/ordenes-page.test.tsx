import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OrdenCatalogos } from '@/features/ordenes/orden-catalogos'
import { OrdenesPage } from '@/features/ordenes/ordenes-page'

const catalogos = {
  clientes: [
    { idCliente: 11, nombreMostrar: 'Cliente A de prueba', estado: 'ACTIVO' },
    { idCliente: 12, nombreMostrar: 'Cliente B de prueba', estado: 'ACTIVO' },
    { idCliente: 13, nombreMostrar: 'Cliente inactivo de prueba', estado: 'INACTIVO' },
    { idCliente: 14, nombreMostrar: 'Cliente sin equipos de prueba', estado: 'ACTIVO' },
  ],
  equipos: [
    { idEquipo: 21, idCliente: 11, modelo: 'Modelo A de prueba', numeroSerie: 'SERIE-A-PRUEBA', estado: 'ACTIVO' },
    { idEquipo: 22, idCliente: 12, modelo: 'Modelo B de prueba', numeroSerie: 'SERIE-B-PRUEBA', estado: 'ACTIVO' },
    { idEquipo: 23, idCliente: 11, modelo: 'Modelo inactivo de prueba', numeroSerie: 'SERIE-INACTIVA-PRUEBA', estado: 'INACTIVO' },
  ],
  prioridades: [{ idPrioridad: 7, nombre: 'Prioridad de prueba' }],
} satisfies OrdenCatalogos

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function openForm(data?: OrdenCatalogos) {
  const view = render(<OrdenesPage catalogos={data} />)
  fireEvent.click(screen.getByRole('button', { name: 'Nueva orden' }))
  return view
}

function fillField(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function selectCatalogs() {
  fillField(/^Cliente/, '11')
  fillField(/^Equipo/, '21')
  fillField(/^Prioridad/, '7')
}

function fillDetails() {
  fillField(/^Problema reportado/, 'No enciende')
  fillField(/^Fecha estimada/, '2026-10-31')
  fillField(/^Observaciones/, 'Revisar cargador')
}

function validate() {
  fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
}

describe('recepción de órdenes', () => {
  it.each(['', '   '])('rechaza el problema obligatorio con valor %j', async value => {
    openForm(catalogos)
    selectCatalogs()
    fillField(/^Problema reportado/, value)
    validate()

    expect(await screen.findByText('Escribe el problema reportado.')).toBeVisible()
    expect(screen.getByLabelText(/^Problema reportado/)).toBeRequired()
    expect(screen.getByLabelText(/^Problema reportado/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^Problema reportado/)).toHaveAccessibleDescription('Escribe el problema reportado.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('requiere cliente, equipo y prioridad sin escribir identificadores', async () => {
    openForm(catalogos)
    fillDetails()
    validate()

    expect(await screen.findByText('Selecciona un cliente activo del catálogo disponible.')).toBeVisible()
    expect(screen.getByText('Selecciona un equipo activo del cliente.')).toBeVisible()
    expect(screen.getByText('Selecciona una prioridad del catálogo disponible.')).toBeVisible()
    for (const name of [/Cliente/, /Equipo/, /Prioridad/]) {
      expect(screen.getByRole('combobox', { name })).toBeRequired()
      expect(screen.getByRole('combobox', { name })).toHaveAttribute('aria-invalid', 'true')
    }
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('filtra equipos activos del cliente y limpia el equipo al cambiar o quitar el cliente', async () => {
    openForm(catalogos)
    expect(screen.getByRole('combobox', { name: /Equipo/ })).toBeDisabled()
    expect(screen.getByText('Selecciona primero un cliente activo.')).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Cliente inactivo de prueba' })).not.toBeInTheDocument()
    selectCatalogs()
    fillDetails()

    const equipos = screen.getByRole('combobox', { name: /Equipo/ })
    expect(within(equipos).getByRole('option', { name: /SERIE-A-PRUEBA/ })).toBeInTheDocument()
    expect(within(equipos).queryByRole('option', { name: /SERIE-B-PRUEBA/ })).not.toBeInTheDocument()
    expect(within(equipos).queryByRole('option', { name: /SERIE-INACTIVA-PRUEBA/ })).not.toBeInTheDocument()
    validate()
    expect(await screen.findByRole('status')).toBeVisible()

    fillField(/^Cliente/, '12')
    expect(equipos).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(within(equipos).queryByRole('option', { name: /SERIE-A-PRUEBA/ })).not.toBeInTheDocument()
    expect(within(equipos).getByRole('option', { name: /SERIE-B-PRUEBA/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Problema reportado/)).toHaveValue('No enciende')
    expect(screen.getByLabelText(/^Prioridad/)).toHaveValue('7')
    expect(screen.getByLabelText(/^Fecha estimada/)).toHaveValue('2026-10-31')
    expect(screen.getByLabelText(/^Observaciones/)).toHaveValue('Revisar cargador')
    validate()
    expect(await screen.findByText('Selecciona un equipo activo del cliente.')).toBeVisible()

    fillField(/^Equipo/, '22')
    await waitFor(() => expect(screen.queryByText('Selecciona un equipo activo del cliente.')).not.toBeInTheDocument())
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('La orden aún no se ha registrado')
    fillField(/^Cliente/, '')
    expect(equipos).toHaveValue('')
    expect(equipos).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('bloquea la validación sin catálogos y no inventa opciones', async () => {
    openForm()
    fillDetails()
    expect(screen.getByText('Catálogo de clientes pendiente de conexión.')).toBeVisible()
    expect(screen.getByText('Catálogo de equipos pendiente de conexión.')).toBeVisible()
    expect(screen.getByText('Catálogo de prioridades pendiente de conexión.')).toBeVisible()
    for (const select of screen.getAllByRole('combobox')) {
      expect(select).toBeDisabled()
      expect(select).toHaveValue('')
      expect(within(select).getAllByRole('option')).toHaveLength(1)
    }
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toHaveAccessibleDescription(/requiere clientes activos/)
    fireEvent.submit(screen.getByRole('form', { name: 'Recepción de orden' }))
    expect(await screen.findByText('Selecciona un cliente activo del catálogo disponible.')).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['clientes', 'equipos', 'prioridades'] as const)('bloquea la validación cuando falta solo %s', field => {
    openForm({ ...catalogos, [field]: undefined })
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('distingue un catálogo de prioridades vacío de uno pendiente', () => {
    openForm({ ...catalogos, prioridades: [] })
    expect(screen.getByText('El catálogo recibido no contiene prioridades.')).toBeVisible()
    expect(screen.queryByText('Catálogo de prioridades pendiente de conexión.')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Prioridad/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
  })

  it('no permite validar para un cliente sin equipos activos recibidos', () => {
    openForm(catalogos)
    fillField(/^Cliente/, '14')
    expect(screen.getByText('El catálogo recibido no contiene equipos activos para este cliente.')).toBeVisible()
    expect(screen.getByRole('combobox', { name: /Equipo/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
  })

  it('acepta los catálogos cuando llegan después de abrir el formulario', async () => {
    const view = openForm()
    fillField(/^Problema reportado/, 'No enciende')
    view.rerender(<OrdenesPage catalogos={catalogos} />)
    selectCatalogs()
    validate()

    expect(await screen.findByRole('status')).toHaveTextContent('La orden aún no se ha registrado: falta conectar la API.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Fecha estimada/)).not.toBeRequired()
    expect(screen.getByLabelText(/^Observaciones/)).not.toBeRequired()
  })

  it.each(['errores', 'validación correcta'])('cancelar limpia valores y mensajes tras %s', async state => {
    openForm(catalogos)
    selectCatalogs()
    fillDetails()
    if (state === 'errores') fillField(/^Problema reportado/, '   ')
    validate()
    if (state === 'errores') expect(await screen.findByText('Escribe el problema reportado.')).toBeVisible()
    else expect(await screen.findByRole('status')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva orden' })).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva orden' }))

    for (const select of screen.getAllByRole('combobox')) expect(select).toHaveValue('')
    for (const label of [/^Problema reportado/, /^Fecha estimada/, /^Observaciones/]) {
      expect(screen.getByLabelText(label)).toHaveValue('')
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'false')
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Equipo/ })).toBeDisabled()
  })

  it('valida sin red, persistencia ni datos de recepción simulados', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    openForm(catalogos)
    selectCatalogs()
    fillDetails()
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('La orden aún no se ha registrado: falta conectar la API.')
    expect(screen.getByText('Al registrarse realmente, la orden iniciará en RECIBIDO.')).toBeVisible()
    expect(screen.getByLabelText(/^Fecha estimada/)).toHaveValue('2026-10-31')
    expect(screen.getByLabelText(/^Fecha estimada/)).not.toHaveAttribute('min')
    expect(screen.queryByLabelText(/número de orden/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/usuario de recepción/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/fecha de ingreso/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Estado/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Consulta de órdenes pendiente de conexión' })).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(xhrSend).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()

    fillField(/^Problema reportado/, 'Se apaga al encender')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
