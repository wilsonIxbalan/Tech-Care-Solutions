import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { SessionProvider } from '@/features/auth/session-provider'
import { SessionGuard } from '@/features/auth/session-guard'
import { ServiceForm } from '@/features/ordenes/service-form'
import { apiFetch } from '@/lib/api-client'
import { adminUser, json } from '../../support/session'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function start() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const saved = vi.fn()
  render(<QueryClientProvider client={client}><SessionProvider><MemoryRouter><Routes>
    <Route element={<SessionGuard />}><Route path="/" element={<ServiceForm title="Registrar actividad" path="/reparaciones/4/actividades"
      schema={z.object({ descripcion: z.string().min(1) })} fields={[{ name: 'descripcion', label: 'Descripción', required: true }]} onSuccess={saved} />} /></Route>
    <Route path="/login" element={<p>Sesión cerrada</p>} />
  </Routes></MemoryRouter></SessionProvider></QueryClientProvider>)
  return { client, saved }
}

it('conserva formulario tras 503, bloquea durante refresh y recupera sin reenviar escrituras', async () => {
  let mode: 'ok' | 'error' | 'pending' = 'ok'
  let resolve!: (response: Response) => void
  const http = vi.fn((url: string) => {
    if (!url.endsWith('/auth/me')) return Promise.resolve(json({ data: { idActividad: 17 } }))
    if (mode === 'pending') return new Promise<Response>(done => { resolve = done })
    return Promise.resolve(mode === 'error' ? json({}, 503) : json({ data: adminUser }))
  })
  vi.stubGlobal('fetch', http)
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  const { client, saved } = start()
  const input = await screen.findByLabelText('Descripción *')
  fireEvent.change(input, { target: { value: 'Borrador sin guardar' } })
  mode = 'error'
  await act(async () => { await client.invalidateQueries({ queryKey: ['session'] }) })
  expect(await screen.findByRole('status')).toHaveTextContent('No pudimos verificar tu sesión')
  expect(screen.getByLabelText('Descripción *')).toBe(input)
  expect(input).toHaveValue('Borrador sin guardar')
  fireEvent.submit(screen.getByRole('form'))
  expect(await screen.findByRole('alert')).toHaveTextContent('La operación no se ha enviado')
  expect(http.mock.calls.filter(([url]) => !url.endsWith('/auth/me'))).toHaveLength(0)
  mode = 'pending'
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar verificación' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar verificación' })).toBeDisabled())
  await expect(apiFetch('/clientes/1', { method: 'PATCH', body: '{}' })).rejects.toMatchObject({ code: 'SESION_NO_VERIFICADA' })
  await act(async () => { resolve(json({ data: adminUser })) })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar verificación' })).not.toBeInTheDocument())
  expect(screen.getByLabelText('Descripción *')).toBe(input)
  expect(http.mock.calls.filter(([url]) => !url.endsWith('/auth/me'))).toHaveLength(0)
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(saved).toHaveBeenCalledOnce())
  expect(http.mock.calls.filter(([url]) => !url.endsWith('/auth/me'))).toHaveLength(1)
  expect(storage).not.toHaveBeenCalled()
})

it.each([401, 403])('retira formulario y caché si me rechaza la sesión (%s)', async status => {
  let invalid = false
  vi.stubGlobal('fetch', vi.fn(async () => invalid
    ? json({ error: { code: status === 401 ? 'SESION_INVALIDA' : 'USUARIO_INACTIVO', message: 'Sesión inválida' }, requestId: 'test' }, status)
    : json({ data: adminUser })))
  const { client } = start()
  await screen.findByLabelText('Descripción *')
  client.setQueryData(['private'], 'secreto')
  invalid = true
  await act(async () => { await client.invalidateQueries({ queryKey: ['session'] }) })
  expect(await screen.findByText('Sesión cerrada')).toBeInTheDocument()
  expect(screen.queryByLabelText('Descripción *')).not.toBeInTheDocument()
  expect(client.getQueryData(['private'])).toBeUndefined()
})
