import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientesPage } from '@/features/clientes/clientes-page'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function openForm() {
  render(<ClientesPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
}

function fillField(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function changeType(value: 'INDIVIDUAL' | 'EMPRESARIAL') {
  fireEvent.change(screen.getByRole('combobox', { name: /Tipo de cliente/ }), { target: { value } })
}

function fillCommonFields() {
  fillField(/^NIT/, 'CF')
  fillField(/^Teléfono/, '+502 2222-3333')
}

function fillIndividual() {
  fillField(/^Nombres/, 'Ana')
  fillField(/^Apellidos/, 'Pérez')
  fillCommonFields()
}

function validate() {
  fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
}

describe('formulario de Clientes', () => {
  it.each(['', '   '])('rechaza campos individuales requeridos con valor %j', async value => {
    openForm()
    for (const label of [/^Nombres/, /^Apellidos/, /^NIT/, /^Teléfono/]) fillField(label, value)
    validate()

    expect(await screen.findByText('Escribe los nombres.')).toBeVisible()
    expect(screen.getByText('Escribe los apellidos.')).toBeVisible()
    expect(screen.getByText('Escribe el NIT.')).toBeVisible()
    expect(screen.getByText('Escribe el teléfono.')).toBeVisible()
    for (const [label, error] of [
      [/^Nombres/, 'Escribe los nombres.'],
      [/^Apellidos/, 'Escribe los apellidos.'],
      [/^NIT/, 'Escribe el NIT.'],
      [/^Teléfono/, 'Escribe el teléfono.'],
    ] as const) {
      expect(screen.getByLabelText(label)).toBeRequired()
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(error)
    }
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['', '   '])('rechaza campos empresariales requeridos con valor %j', async value => {
    openForm()
    changeType('EMPRESARIAL')
    for (const label of [/^Razón social/, /^NIT/, /^Teléfono/]) fillField(label, value)
    validate()

    expect(await screen.findByText('Escribe la razón social.')).toBeVisible()
    expect(screen.getByText('Escribe el NIT.')).toBeVisible()
    expect(screen.getByText('Escribe el teléfono.')).toBeVisible()
    expect(screen.getByLabelText(/^Razón social/)).toHaveAccessibleDescription('Escribe la razón social.')
    expect(screen.getByLabelText('Nombre de contacto')).not.toBeRequired()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('cambia entre tipos, conserva campos comunes y limpia los campos que dejan de corresponder', async () => {
    openForm()
    fillIndividual()
    fillField(/^Correo electrónico/, 'contacto@example.test')
    fillField(/^Dirección/, 'Zona 1')
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('El cliente aún no se ha guardado')

    changeType('EMPRESARIAL')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Nombres/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Apellidos/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Razón social/)).toHaveValue('')
    fillField(/^Razón social/, 'Empresa de prueba')
    fillField(/^Nombre de contacto/, 'Ana Pérez')
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('Los datos son válidos.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    changeType('INDIVIDUAL')
    expect(screen.queryByLabelText(/^Razón social/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Nombre de contacto/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombres/)).toHaveValue('')
    expect(screen.getByLabelText(/^Apellidos/)).toHaveValue('')
    expect(screen.getByLabelText(/^NIT/)).toHaveValue('CF')
    expect(screen.getByLabelText(/^Teléfono/)).toHaveValue('+502 2222-3333')
    expect(screen.getByLabelText(/^Correo electrónico/)).toHaveValue('contacto@example.test')
    expect(screen.getByLabelText(/^Dirección/)).toHaveValue('Zona 1')
    validate()
    expect(await screen.findByText('Escribe los nombres.')).toBeVisible()

    changeType('EMPRESARIAL')
    expect(screen.queryByText('Escribe los nombres.')).not.toBeInTheDocument()
    expect(screen.queryByText('Escribe los apellidos.')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Razón social/)).toHaveValue('')
    expect(screen.getByLabelText(/^Nombre de contacto/)).toHaveValue('')
    fillField(/^Razón social/, 'Empresa de prueba')
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('El cliente aún no se ha guardado')
  })

  it.each(['', '   '])('permite un correo opcional con valor %j', async email => {
    openForm()
    fillIndividual()
    fillField(/^Correo electrónico/, email)
    validate()

    expect(await screen.findByRole('status')).toHaveTextContent('Los datos son válidos.')
    expect(screen.getByLabelText(/^Correo electrónico/)).not.toBeRequired()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra el error del correo y permite corregirlo', async () => {
    openForm()
    fillIndividual()
    fillField(/^Correo electrónico/, 'correo-invalido')
    validate()

    expect(await screen.findByText('Escribe un correo válido.')).toBeVisible()
    expect(screen.getByLabelText(/^Correo electrónico/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^Correo electrónico/)).toHaveAccessibleDescription('Escribe un correo válido.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fillField(/^Correo electrónico/, 'contacto@example.test')
    await waitFor(() => expect(screen.queryByText('Escribe un correo válido.')).not.toBeInTheDocument())
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('Los datos son válidos.')
  })

  it('al cancelar limpia valores, tipo y errores para la siguiente apertura', async () => {
    openForm()
    changeType('EMPRESARIAL')
    fillCommonFields()
    fillField(/^Nombre de contacto/, 'Ana Pérez')
    fillField(/^Correo electrónico/, 'contacto@example.test')
    fillField(/^Dirección/, 'Zona 1')
    validate()
    expect(await screen.findByText('Escribe la razón social.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }))

    expect(screen.getByRole('combobox', { name: /Tipo de cliente/ })).toHaveValue('INDIVIDUAL')
    for (const label of [/^Nombres/, /^Apellidos/, /^NIT/, /^Teléfono/, /^Correo electrónico/, /^Dirección/]) {
      expect(screen.getByLabelText(label)).toHaveValue('')
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'false')
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    changeType('EMPRESARIAL')
    expect(screen.getByLabelText(/^Razón social/)).toHaveValue('')
    expect(screen.getByLabelText(/^Nombre de contacto/)).toHaveValue('')
  })

  it('limpia el mensaje al editar o cancelar después de validar', async () => {
    openForm()
    fillIndividual()
    validate()
    expect(await screen.findByRole('status')).toBeVisible()

    fillField(/^Nombres/, 'Ana María')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    validate()
    expect(await screen.findByRole('status')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    expect(screen.getByLabelText(/^Nombres/)).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('valida sin red ni almacenamiento y mantiene visible la dependencia de la API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    openForm()
    fillIndividual()
    validate()

    expect(await screen.findByRole('status')).toHaveTextContent('El cliente aún no se ha guardado: falta conectar la API.')
    expect(screen.getByRole('heading', { name: 'Consulta de clientes pendiente de conexión' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(xhrSend).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
