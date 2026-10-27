import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { SessionContext } from '@/features/auth/session-context'
import type { ClienteDto, EquipoDto } from '@/types/domain'

export const cliente: ClienteDto = { idCliente: 11, tipoCliente: 'INDIVIDUAL', nombres: 'Ana', apellidos: 'Pérez', razonSocial: null, nombreContacto: null, nombreMostrar: 'Ana Pérez', nit: 'CF', telefono: '22223333', email: null, direccion: null, estado: 'ACTIVO', fechaRegistro: '2026-10-22T12:00:00Z' }
export const equipo: EquipoDto = { idEquipo: 31, idCliente: 11, clienteNombre: 'Ana Pérez', idTipoEquipo: 7, tipoEquipoNombre: 'Laptop', idMarca: 23, marcaNombre: 'Marca de prueba', modelo: 'Modelo de prueba', numeroSerie: 'SERIE-PRUEBA', descripcion: 'Equipo con cargador', estado: 'ACTIVO', fechaRegistro: '2026-10-22T12:00:00Z' }
export const catalogos = { tiposEquipo: [{ id: 7, nombre: 'Laptop' }], marcas: [{ id: 23, nombre: 'Marca de prueba' }] }
export function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }) }
export function list(data: unknown[], page = 1, totalPages = 1) { return { data, meta: { page, pageSize: 20, total: totalPages * data.length, totalPages } } }
export function mockHttp(override?: (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const result = override?.(url, init)
    if (result) return result
    if (init?.method === 'POST' || init?.method === 'PATCH') return json({ data: url.pathname.includes('equipos') ? equipo : cliente }, init.method === 'POST' ? 201 : 200)
    if (url.pathname.endsWith('/catalogos')) return json({ data: catalogos })
    if (url.pathname.endsWith('/clientes')) return json(list([cliente], Number(url.searchParams.get('page')) || 1))
    if (url.pathname.endsWith('/equipos')) return json(list([equipo], Number(url.searchParams.get('page')) || 1))
    throw new Error(`Petición no simulada: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
export function renderFeature(children: ReactNode, permisos = ['CLIENTES_GESTIONAR', 'EQUIPOS_GESTIONAR']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const view = render(<QueryClientProvider client={client}><SessionContext.Provider value={{ user: { idUsuario: 99, nombreUsuario: 'test', nombreCompleto: 'Usuario sintético', roles: ['RECEPCION'], permisos }, pending: false, error: null, refresh: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }}>{children}</SessionContext.Provider></QueryClientProvider>)
  return { ...view, client }
}
