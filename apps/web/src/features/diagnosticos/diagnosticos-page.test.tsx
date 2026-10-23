import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiagnosticoCatalogos } from '@/features/diagnosticos/diagnostico-catalogos'
import { DiagnosticosPage } from '@/features/diagnosticos/diagnosticos-page'

const catalogos = {
  ordenes: [
    { idOrden: 21, numeroOrden: 'ORDEN-RECIBIDA-PRUEBA', estado: 'RECIBIDO' },
    { idOrden: 22, numeroOrden: 'ORDEN-DIAGNOSTICO-PRUEBA', estado: 'DIAGNOSTICO' },
    { idOrden: 23, numeroOrden: 'ORDEN-REPARACION-PRUEBA', estado: 'REPARACION' },
  ],
  tecnicos: [
    { idTecnico: 31, nombreCompleto: 'Técnico autorizado de prueba', activo: true, roles: ['TECNICO'], permisos: ['DIAGNOSTICO_REGISTRAR'] },
    { idTecnico: 32, nombreCompleto: 'Técnico inactivo de prueba', activo: false, roles: ['TECNICO'], permisos: ['DIAGNOSTICO_REGISTRAR'] },
    { idTecnico: 33, nombreCompleto: 'Usuario sin rol de prueba', activo: true, roles: [], permisos: ['DIAGNOSTICO_REGISTRAR'] },
    { idTecnico: 34, nombreCompleto: 'Técnico sin permiso de prueba', activo: true, roles: ['TECNICO'], permisos: [] },
  ],
} satisfies DiagnosticoCatalogos

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function openForm(data?: DiagnosticoCatalogos) {
  const view = render(<DiagnosticosPage catalogos={data} />)
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo diagnóstico' }))
  return view
}

function fillField(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function selectCatalogs() {
  fillField(/^Orden/, '21')
  fillField(/^Técnico responsable/, '31')
}

function fillDetails() {
  fillField(/^Descripción/, 'Diagnóstico de prueba')
  fillField(/^Costo estimado/, '0')
}

function validate() {
  fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
}

describe('sección de Diagnósticos', () => {
  it('separa los formularios provisionales y conserva las operaciones posteriores pendientes', () => {
    render(<DiagnosticosPage />)
    expect(within(screen.getByRole('region', { name: 'Diagnósticos' })).getByRole('button', { name: 'Nuevo diagnóstico' })).toBeVisible()
    const reparaciones = screen.getByRole('region', { name: 'Reparaciones' })
    expect(within(reparaciones).getByRole('heading', { name: 'Consulta de reparaciones pendiente de conexión' })).toBeVisible()
    expect(within(reparaciones).getByRole('button', { name: 'Preparar reparación' })).toBeVisible()
    expect(within(reparaciones).queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Consulta de diagnósticos pendiente de conexión' })).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('explica los catálogos pendientes y bloquea incluso un submit sin pulsar el botón', async () => {
    openForm()
    fillDetails()
    expect(screen.getByText('Catálogo de órdenes pendiente de conexión.')).toBeVisible()
    expect(screen.getByText('Catálogo de técnicos pendiente de conexión.')).toBeVisible()
    for (const select of screen.getAllByRole('combobox')) {
      expect(select).toBeDisabled()
      expect(select).toHaveValue('')
      expect(within(select).getAllByRole('option')).toHaveLength(1)
    }
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar diagnóstico' }))
    expect(await screen.findByText('Selecciona una orden recibida o en diagnóstico del catálogo disponible.')).toBeVisible()
    expect(screen.getByText('Selecciona un técnico elegible del catálogo disponible.')).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['ordenes', 'tecnicos'] as const)('bloquea la validación si falta solo %s', field => {
    openForm({ ...catalogos, [field]: undefined })
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('distingue un catálogo recibido sin órdenes permitidas de uno no conectado', () => {
    openForm({ ...catalogos, ordenes: [catalogos.ordenes[2]], tecnicos: [] })
    expect(screen.getByText('El catálogo recibido no contiene órdenes en RECIBIDO o DIAGNOSTICO.')).toBeVisible()
    expect(screen.getByText('El catálogo recibido no contiene técnicos elegibles.')).toBeVisible()
    expect(screen.queryByText('Catálogo de órdenes pendiente de conexión.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
  })

  it('solo ofrece órdenes con estado permitido y técnicos activos con rol y permiso', () => {
    openForm(catalogos)
    const orden = screen.getByRole('combobox', { name: /Orden/ })
    expect(within(orden).getByRole('option', { name: /ORDEN-RECIBIDA-PRUEBA/ })).toBeInTheDocument()
    expect(within(orden).getByRole('option', { name: /ORDEN-DIAGNOSTICO-PRUEBA/ })).toBeInTheDocument()
    expect(within(orden).queryByRole('option', { name: /ORDEN-REPARACION-PRUEBA/ })).not.toBeInTheDocument()
    const tecnico = screen.getByRole('combobox', { name: /Técnico responsable/ })
    expect(within(tecnico).getAllByRole('option')).toHaveLength(2)
    expect(within(tecnico).getByRole('option', { name: 'Técnico autorizado de prueba' })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('exige seleccionar orden y técnico aunque los catálogos estén disponibles', async () => {
    openForm(catalogos)
    fillDetails()
    validate()
    expect(await screen.findByText('Selecciona una orden recibida o en diagnóstico del catálogo disponible.')).toBeVisible()
    expect(screen.getByText('Selecciona un técnico elegible del catálogo disponible.')).toBeVisible()
    expect(screen.getByRole('combobox', { name: /Orden/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('combobox', { name: /Técnico responsable/ })).toHaveAccessibleDescription(/Selecciona un técnico elegible del catálogo disponible/)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['', '   '])('rechaza descripción y costo obligatorios con valor %j y enfoca el primer error', async value => {
    openForm(catalogos)
    selectCatalogs()
    fillField(/^Descripción/, value)
    fillField(/^Costo estimado/, value)
    validate()
    expect(await screen.findByText('Escribe la descripción del diagnóstico.')).toBeVisible()
    expect(screen.getByText('Escribe el costo estimado de mano de obra.')).toBeVisible()
    expect(screen.getByLabelText(/^Descripción/)).toHaveAccessibleDescription('Escribe la descripción del diagnóstico.')
    expect(screen.getByLabelText(/^Costo estimado/)).toHaveAccessibleDescription(/Escribe el costo estimado de mano de obra/)
    await waitFor(() => expect(screen.getByLabelText(/^Descripción/)).toHaveFocus())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('muestra un error de precisión junto al importe y permite corregirlo', async () => {
    openForm(catalogos)
    selectCatalogs()
    fillDetails()
    fillField(/^Costo estimado/, '1.234')
    validate()
    expect(await screen.findByText('Escribe un importe no negativo con punto decimal y hasta dos decimales.')).toBeVisible()
    const costo = screen.getByLabelText(/^Costo estimado/)
    expect(costo).toHaveAttribute('type', 'text')
    expect(costo).toHaveAttribute('inputmode', 'decimal')
    expect(costo).toHaveAttribute('aria-invalid', 'true')
    expect(costo).toHaveAccessibleDescription(/hasta dos decimales/)
    fillField(/^Costo estimado/, '1.23')
    await waitFor(() => expect(costo).toHaveAttribute('aria-invalid', 'false'))
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('El diagnóstico aún no se ha guardado')
  })

  it.each(['errores', 'validación correcta'])('cancelar limpia selecciones, descripción, costo y mensajes tras %s', async state => {
    openForm(catalogos)
    selectCatalogs()
    fillDetails()
    if (state === 'errores') fillField(/^Costo estimado/, '-1')
    validate()
    if (state === 'errores') expect(await screen.findByRole('alert')).toBeVisible()
    else expect(await screen.findByRole('status')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo diagnóstico' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo diagnóstico' }))
    for (const select of screen.getAllByRole('combobox')) expect(select).toHaveValue('')
    expect(screen.getByLabelText(/^Descripción/)).toHaveValue('')
    expect(screen.getByLabelText(/^Costo estimado/)).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('valida costo cero con catálogos recibidos posteriormente, sin red, persistencia ni transiciones', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const view = openForm()
    fillDetails()
    view.rerender(<DiagnosticosPage catalogos={catalogos} />)
    selectCatalogs()
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('El diagnóstico aún no se ha guardado: falta conectar la API.')
    expect(screen.getByText(/Seleccionar un técnico no autoriza la operación/)).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Estado/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/identificador/i)).not.toBeInTheDocument()
    expect(catalogos.ordenes[0].estado).toBe('RECIBIDO')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(xhrSend).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
    fillField(/^Descripción/, 'Otro diagnóstico de prueba')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
