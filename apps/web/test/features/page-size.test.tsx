import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientesPage } from '@/features/clientes/clientes-page'
import { EquiposPage } from '@/features/equipos/equipos-page'
import { UsuariosPage } from '@/features/usuarios/usuarios-page'
import { FacturacionPage } from '@/features/facturacion/facturacion-page'
import { RepuestosPage } from '@/features/repuestos/repuestos-page'
import { ProveedoresPage } from '@/features/proveedores/proveedores-page'
import { OrdenesPage } from '@/features/ordenes/ordenes-page'
import { ComprasPage } from '@/features/compras/compras-page'
import { json, renderWithSession } from '../support/session'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('Tamaños de pagina validos en todos los listados', () => {
  it.each([
    ['clientes', ClientesPage], ['equipos', EquiposPage], ['usuarios', UsuariosPage],
    ['facturas', FacturacionPage], ['repuestos', RepuestosPage], ['proveedores', ProveedoresPage],
    ['ordenes', OrdenesPage], ['compras', ComprasPage],
  ] as const)('%s solo permite 5/10/20/50 y nunca consulta pageSize=0', async (_name, Page) => {
    const http = vi.fn(async (raw: string) => raw.includes('/catalogos')
      ? json({ data: { roles: [], tiposEquipo: [], marcas: [], categoriasRepuesto: [], tiposMovimiento: [], prioridades: [], tecnicos: [], estadosOrden: [] } })
      : json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }))
    vi.stubGlobal('fetch', http)
    renderWithSession(<Page />)
    const select = screen.getByRole('combobox', { name: 'Por página' }) as HTMLSelectElement
    expect([...select.options].map(option => option.value)).toEqual(['5', '10', '20', '50'])
    expect(select).toHaveValue('5')
    await waitFor(() => expect(http.mock.calls.some(([url]) => {
      const request = new URL(url, 'http://localhost')
      return request.pathname.endsWith('/' + _name) && request.searchParams.get('pageSize') === '5'
    })).toBe(true))
    fireEvent.change(select, { target: { value: '' } })
    fireEvent.change(select, { target: { value: '50' } })
    if (_name === 'facturas') fireEvent.submit(screen.getByRole('form', { name: 'Filtros de facturas' }))
    await waitFor(() => expect(http.mock.calls.some(([url]) => new URL(url, 'http://localhost').searchParams.get('pageSize') === '50')).toBe(true))
    expect(http.mock.calls.some(([url]) => new URL(url, 'http://localhost').searchParams.get('pageSize') === '0')).toBe(false)
  })
})
