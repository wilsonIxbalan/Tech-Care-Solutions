import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { PropsWithChildren, ReactElement } from 'react'
import { SessionContext, type SessionContextValue } from '@/features/auth/session-context'
import type { SessionUser } from '@/types/api'

export const adminUser: SessionUser = { idUsuario: 1, nombreUsuario: 'wilson', nombreCompleto: 'Wilson Pérez', roles: ['ADMINISTRADOR'], permisos: ['CLIENTES_GESTIONAR', 'EQUIPOS_GESTIONAR', 'ORDENES_CREAR', 'DIAGNOSTICO_REGISTRAR', 'REPARACION_GESTIONAR', 'REPUESTOS_CONSUMIR', 'INVENTARIO_GESTIONAR', 'COMPRAS_GESTIONAR', 'PROVEEDORES_GESTIONAR', 'FACTURAR', 'PAGOS_REGISTRAR', 'ENTREGAR_ORDEN', 'REPORTES_VER'] }
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
export function renderWithSession(ui: ReactElement, overrides: Partial<SessionContextValue> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const value: SessionContextValue = { user: adminUser, pending: false, error: null, refresh: async () => {}, signIn: async () => {}, signOut: async () => {}, ...overrides }
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}><SessionContext.Provider value={value}><MemoryRouter>{children}</MemoryRouter></SessionContext.Provider></QueryClientProvider> }
  return { ...render(ui, { wrapper: Wrapper }), client }
}
