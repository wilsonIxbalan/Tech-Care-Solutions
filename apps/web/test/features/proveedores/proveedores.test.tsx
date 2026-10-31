import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProveedoresPage } from '@/features/proveedores/proveedores-page'
import { proveedorSchema } from '@/features/proveedores/proveedor-schema'
import { adminUser, errorResponse, json, list, mockSupply, proveedor, renderWithSession, writes } from '../inventario/supply-fixtures'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
function fill() {
  for (const [label, value] of [['NIT *', ' 123-6 '], ['Nombre *', ' Nuevo proveedor '], ['Teléfono *', '22223333']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
describe('proveedores HTTP', () => {
  it('valida obligatorios, longitudes y email opcional', () => {
    const valid = { nit: '123-6', nombre: 'Proveedor', telefono: '2222-3333', nombreContacto: '', email: '', direccion: '' }
    expect(proveedorSchema.safeParse(valid).success).toBe(true)
    for (const patch of [{ nit: ' ' }, { nit: 'CF' }, { nit: '123-7' }, { telefono: 'Texto' }, { nombre: ' ' }, { telefono: '1'.repeat(21) }, { email: 'inválido' }]) expect(proveedorSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
  it('consulta y pagina en servidor; buscar o filtrar reinicia página', async () => {
    const http = mockSupply(url => url.pathname.endsWith('/proveedores') ? json(list([proveedor], Number(url.searchParams.get('page')), 3)) : undefined)
    renderWithSession(<ProveedoresPage />)
    await screen.findByText(proveedor.nombre)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente proveedores' }))
    await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true))
    fireEvent.change(screen.getByLabelText('Buscar por NIT o nombre'), { target: { value: 'ABC' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'INACTIVO' } })
    await waitFor(() => expect(http.mock.calls.some(([url]) => String(url).includes('search=ABC') && String(url).includes('estado=INACTIVO') && String(url).includes('page=1'))).toBe(true))
  })
  it('crea POST solo DTO normalizado e invalida dashboard', async () => {
    const http = mockSupply(); const { client } = renderWithSession(<ProveedoresPage />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo proveedor' })); fill()
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar proveedor' }))
    await waitFor(() => expect(writes(http)).toHaveLength(1))
    expect(JSON.parse(String(writes(http)[0][1]?.body))).toEqual({ nit: '123-6', nombre: 'Nuevo proveedor', telefono: '22223333', nombreContacto: null, email: null, direccion: null, estado: 'ACTIVO' })
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['proveedores'] })
  })
  it.each([400, 409])('PATCH conserva campos y detalles %s', async status => {
    const http = mockSupply((_url, init) => init?.method === 'PATCH' ? errorResponse(status) : undefined)
    renderWithSession(<ProveedoresPage />)
    fireEvent.click(await screen.findByRole('button', { name: `Editar ${proveedor.nombre}` }))
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Modificado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }))
    expect(await screen.findByText('Operación rechazada.')).toBeVisible()
    expect(screen.getByText('observacion: Revisa el motivo.')).toBeVisible()
    expect(screen.getByText('Referencia: req-stock')).toBeVisible()
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Modificado')
    expect(writes(http)[0][0]).toContain('/proveedores/101')
    expect(writes(http)).toHaveLength(1)
  })
  it('permite REPORTES_VER solo lectura y no consulta sin permiso', async () => {
    const http = mockSupply()
    const view = renderWithSession(<ProveedoresPage />, { user: { ...adminUser, roles: ['CAJA'], permisos: ['REPORTES_VER'] } })
    await screen.findByText(proveedor.nombre)
    expect(screen.queryByRole('button', { name: /Nuevo proveedor|Editar/ })).not.toBeInTheDocument()
    view.unmount(); http.mockClear()
    renderWithSession(<ProveedoresPage />, { user: { ...adminUser, permisos: [] } })
    expect(screen.getByText('Acceso restringido')).toBeVisible(); expect(http).not.toHaveBeenCalled()
  })
  it('distingue carga, error y vacío con reintento de consulta', async () => {
    let fail = true
    mockSupply(url => url.pathname.endsWith('/proveedores') ? fail ? errorResponse(503) : json(list([])) : undefined)
    renderWithSession(<ProveedoresPage />)
    expect(screen.getByText('Consultando Proveedores…')).toBeVisible()
    expect(await screen.findByText('Operación rechazada.')).toBeVisible()
    fail = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }))
    expect(await screen.findByText('Consulta sin resultados')).toBeVisible()
  })
})
