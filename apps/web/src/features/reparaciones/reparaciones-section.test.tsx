import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReparacionCatalogos } from '@/features/reparaciones/reparacion-catalogos'
import { ReparacionesSection } from '@/features/reparaciones/reparaciones-section'

const catalogos = {
  ordenes: [
    { idOrden: 21, numeroOrden: 'ORDEN-A-PRUEBA', estado: 'ESPERANDO_AUTORIZACION' },
    { idOrden: 22, numeroOrden: 'ORDEN-B-PRUEBA', estado: 'REPARACION' },
    { idOrden: 23, numeroOrden: 'ORDEN-C-PRUEBA', estado: 'RECIBIDO' },
    { idOrden: 24, numeroOrden: 'ORDEN-SIN-DIAGNOSTICO-PRUEBA', estado: 'ESPERANDO_AUTORIZACION' },
  ],
  diagnosticos: [
    { idDiagnostico: 41, idOrden: 21, idTecnico: 31, descripcion: 'Diagnóstico A de prueba', estado: 'ACTIVO' },
    { idDiagnostico: 42, idOrden: 22, idTecnico: 31, descripcion: 'Diagnóstico B de prueba', estado: 'ACTIVO' },
    { idDiagnostico: 43, idOrden: 21, idTecnico: 31, descripcion: 'Diagnóstico anulado de prueba', estado: 'ANULADO' },
  ],
  tecnicos: [
    { idTecnico: 33, nombreCompleto: 'Responsable de reparación de prueba', activo: true, roles: ['TECNICO'], permisos: ['REPARACION_GESTIONAR'] },
    { idTecnico: 34, nombreCompleto: 'Técnico sin permiso de prueba', activo: true, roles: ['TECNICO'], permisos: ['DIAGNOSTICO_REGISTRAR'] },
  ],
} satisfies ReparacionCatalogos

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function openForm(data?: ReparacionCatalogos) {
  const view = render(<ReparacionesSection catalogos={data} />)
  fireEvent.click(screen.getByRole('button', { name: 'Preparar reparación' }))
  return view
}

function fillField(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function selectCatalogs() {
  fillField(/^Orden/, '21')
  fillField(/^Diagnóstico previo/, '41')
  fillField(/^Técnico responsable/, '33')
}

function fillDetails() {
  fillField(/^Descripción de la reparación/, 'Trabajo de prueba')
  fillField(/^Costo de mano de obra/, '0')
}

function validate() {
  fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
}

describe('preparación del inicio de reparación', () => {
  it('mantiene actividades, finalización y repuestos como pendientes sin formularios ni reparaciones simuladas', () => {
    render(<ReparacionesSection />)
    for (const text of ['Actividades', 'Finalización', 'Consumo de repuestos']) expect(screen.getByText(text)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Después de registrar la reparación' })).toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('no inventa catálogos ni permite un envío completo sin ellos', async () => {
    openForm()
    fillDetails()
    for (const name of ['órdenes', 'diagnósticos', 'técnicos']) {
      expect(screen.getByText(`Catálogo de ${name} pendiente de conexión.`)).toBeVisible()
    }
    for (const select of screen.getAllByRole('combobox')) {
      expect(select).toBeDisabled()
      expect(within(select).getAllByRole('option')).toHaveLength(1)
    }
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Preparar inicio de reparación' }))
    expect(await screen.findByText('Selecciona una orden en espera de autorización o en reparación.')).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['ordenes', 'diagnosticos', 'tecnicos'] as const)('bloquea la validación al faltar solo %s', field => {
    openForm({ ...catalogos, [field]: undefined })
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('muestra únicamente diagnósticos activos de la orden y limpia la selección al cambiarla', async () => {
    openForm(catalogos)
    expect(screen.getByRole('combobox', { name: /Diagnóstico previo/ })).toBeDisabled()
    selectCatalogs()
    fillDetails()
    const diagnostico = screen.getByRole('combobox', { name: /Diagnóstico previo/ })
    expect(within(diagnostico).getByRole('option', { name: 'Diagnóstico A de prueba' })).toBeInTheDocument()
    expect(within(diagnostico).queryByRole('option', { name: 'Diagnóstico B de prueba' })).not.toBeInTheDocument()
    expect(within(diagnostico).queryByRole('option', { name: 'Diagnóstico anulado de prueba' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /ORDEN-C-PRUEBA/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Técnico sin permiso de prueba' })).not.toBeInTheDocument()
    validate()
    expect(await screen.findByRole('status')).toBeVisible()

    fillField(/^Orden/, '22')
    expect(diagnostico).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Técnico responsable/)).toHaveValue('33')
    expect(screen.getByLabelText(/^Descripción/)).toHaveValue('Trabajo de prueba')
    expect(screen.getByLabelText(/^Costo de mano de obra/)).toHaveValue('0')
    expect(within(diagnostico).queryByRole('option', { name: 'Diagnóstico A de prueba' })).not.toBeInTheDocument()
    expect(within(diagnostico).getByRole('option', { name: 'Diagnóstico B de prueba' })).toBeInTheDocument()
    validate()
    expect(await screen.findByText('Selecciona un diagnóstico activo de la orden.')).toBeVisible()
    fillField(/^Diagnóstico previo/, '42')
    await waitFor(() => expect(screen.queryByText('Selecciona un diagnóstico activo de la orden.')).not.toBeInTheDocument())
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('La reparación aún no se ha guardado ni iniciado')
  })

  it('bloquea una orden sin diagnóstico activo recibido sin decir que su catálogo no está conectado', () => {
    openForm(catalogos)
    fillField(/^Orden/, '24')
    expect(screen.getByText('El catálogo recibido no contiene un diagnóstico activo para esta orden.')).toBeVisible()
    expect(screen.queryByText('Catálogo de diagnósticos pendiente de conexión.')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Diagnóstico previo/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeDisabled()
  })

  it.each(['', '   '])('rechaza descripción y costo obligatorios con valor %j y muestra errores accesibles', async value => {
    openForm(catalogos)
    selectCatalogs()
    fillField(/^Descripción/, value)
    fillField(/^Costo de mano de obra/, value)
    validate()
    expect(await screen.findByText('Escribe la descripción de la reparación.')).toBeVisible()
    expect(screen.getByText('Escribe el costo de mano de obra.')).toBeVisible()
    expect(screen.getByLabelText(/^Descripción/)).toHaveAccessibleDescription('Escribe la descripción de la reparación.')
    expect(screen.getByLabelText(/^Costo de mano de obra/)).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(screen.getByLabelText(/^Costo de mano de obra/)).toHaveFocus())
  })

  it('aplica la validación monetaria compartida al campo de mano de obra', async () => {
    openForm(catalogos)
    selectCatalogs()
    fillDetails()
    fillField(/^Costo de mano de obra/, '1.234')
    validate()
    expect(await screen.findByText('Escribe un importe no negativo con punto decimal y hasta dos decimales.')).toBeVisible()
    const costo = screen.getByLabelText(/^Costo de mano de obra/)
    expect(costo).toHaveAttribute('type', 'text')
    expect(costo).toHaveAttribute('inputmode', 'decimal')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['errores', 'validación correcta'])('cancelar limpia valores y mensajes después de %s y devuelve el foco', async state => {
    openForm(catalogos)
    selectCatalogs()
    fillDetails()
    if (state === 'errores') fillField(/^Costo de mano de obra/, '-1')
    validate()
    if (state === 'errores') expect(await screen.findByRole('alert')).toBeVisible()
    else expect(await screen.findByRole('status')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preparar reparación' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Preparar reparación' }))
    for (const select of screen.getAllByRole('combobox')) expect(select).toHaveValue('')
    expect(screen.getByLabelText(/^Descripción/)).toHaveValue('')
    expect(screen.getByLabelText(/^Costo de mano de obra/)).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('acepta catálogos recibidos posteriormente y valida cero sin red, persistencia ni cambios de estado', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const view = openForm()
    fillDetails()
    view.rerender(<ReparacionesSection catalogos={catalogos} />)
    selectCatalogs()
    validate()
    expect(await screen.findByRole('status')).toHaveTextContent('La reparación aún no se ha guardado ni iniciado: falta conectar la API.')
    expect(screen.getByText(/Seleccionar un técnico elegible no autoriza la operación/)).toBeVisible()
    expect(screen.getByText(/El servidor comprobará que la orden no esté facturada/)).toBeVisible()
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Estado/)).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(catalogos.ordenes[0].estado).toBe('ESPERANDO_AUTORIZACION')
    expect(catalogos.diagnosticos[0].estado).toBe('ACTIVO')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(xhrSend).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
    fillField(/^Descripción/, 'Otro trabajo de prueba')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
