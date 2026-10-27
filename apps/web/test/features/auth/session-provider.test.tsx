import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/features/auth/session-provider'
import { useSession } from '@/features/auth/session-context'
import { apiFetch } from '@/lib/api-client'
import { adminUser, json } from '../../support/session'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function Probe() {
  const session = useSession()
  const [message, setMessage] = useState('')
  return <><p aria-label="Usuario de sesión">{session.pending ? 'Verificando' : session.user?.nombreUsuario ?? 'Sin sesión'}</p>
    <button onClick={() => void session.signIn({ nombreUsuario: 'wilson@example.com', password: ' clave segura ' }).catch(error => setMessage(error.message))}>Entrar</button>
    <button onClick={() => void session.signOut().catch(() => setMessage('No se cerró'))}>Salir</button>
    <button onClick={() => void session.refresh()}>Actualizar sesión</button>
    {message && <p role="alert">{message}</p>}</>
}
function start() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><SessionProvider><Probe /></SessionProvider></QueryClientProvider>)
  return client
}

describe('sesión remota por cookie', () => {
  it('recupera me; login conserva contrato/cookies sin tokens y limpia caché previa', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/auth/me') ? json({ error: { code: 'SESION_INVALIDA', message: 'Inicia sesión.' }, requestId: 'test' }, 401) : json({ data: { usuario: adminUser, expiresIn: 3600 } })))
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const client = start()
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('Sin sesión'))
    client.setQueryData(['private', 'old-user'], { email: 'private@example.com' })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('wilson'))
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ method: 'POST', credentials: 'include', body: '{"nombreUsuario":"wilson@example.com","password":" clave segura "}' }))
    expect(client.getQueryData(['private', 'old-user'])).toBeUndefined()
    expect(storage).not.toHaveBeenCalled()
    expect(client.getQueryData(['session'])).not.toHaveProperty('accessToken')
    storage.mockRestore()
  })
  it('limpia sesión, consultas y mutaciones tras logout confirmado', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json({ data: url.endsWith('/auth/me') ? adminUser : { message: 'Sesión cerrada.' } })))
    const client = start()
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('wilson'))
    client.setQueryData(['private'], 'dato protegido')
    client.getMutationCache().build(client, { mutationKey: ['old-mutation'] })
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('Sin sesión'))
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'include', body: '{}' }))
    expect(client.getQueryData(['private'])).toBeUndefined()
    expect(client.getMutationCache().getAll()).toHaveLength(0)
  })
  it('un 401 protegido cancela lecturas pendientes y elimina datos sin bucles ni reintentos', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/auth/me') ? json({ data: adminUser }) : json({ error: { code: 'SESION_INVALIDA', message: 'Inicia sesión.' }, requestId: 'test' }, 401)))
    const client = start()
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('wilson'))
    client.setQueryData(['private'], 'dato protegido')
    let finish!: (value: string) => void
    const late = client.fetchQuery({ queryKey: ['late'], queryFn: () => new Promise<string>(resolve => { finish = resolve }) }).catch(() => undefined)
    await act(async () => { await apiFetch('/usuarios').catch(() => {}); finish('dato tardío'); await late })
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('Sin sesión'))
    expect(client.getQueryData(['private'])).toBeUndefined()
    expect(client.getQueryData(['late'])).toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('un me expirado al refrescar también retira la caché anterior', async () => {
    let expired = false
    vi.stubGlobal('fetch', vi.fn(async () => expired ? json({ error: { code: 'SESION_INVALIDA', message: 'Inicia sesión.' }, requestId: 'test' }, 401) : json({ data: adminUser })))
    const client = start()
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('wilson'))
    client.setQueryData(['private'], 'dato protegido')
    expired = true
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar sesión' }))
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('Sin sesión'))
    expect(client.getQueryData(['private'])).toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(['identidad', 'roles'] as const)('un cambio de %s en otra pestaña limpia los datos anteriores antes de actualizar me', async change => {
    let changed = false
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: changed ? { ...adminUser, ...(change === 'identidad' ? { idUsuario: 2, nombreUsuario: 'otro' } : { roles: ['CAJA'], permisos: ['REPORTES_VER', 'PAGOS_REGISTRAR'] }) } : adminUser })))
    const client = start()
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('wilson'))
    client.setQueryData(['private'], 'dato protegido')
    changed = true
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar sesión' }))
    await waitFor(() => expect(client.getQueryData(['private'])).toBeUndefined())
    if (change === 'identidad') expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('otro')
    else expect(client.getQueryData(['session'])).toMatchObject({ roles: ['CAJA'] })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('no finge logout cuando falla el servidor y permite reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/auth/me') ? json({ data: adminUser }) : json({ error: { code: 'SERVICIO_NO_DISPONIBLE', message: 'Intenta nuevamente.' }, requestId: 'test' }, 503)))
    const client = start()
    await waitFor(() => expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('wilson'))
    client.setQueryData(['private'], 'dato protegido')
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se cerró')
    expect(screen.getByLabelText('Usuario de sesión')).toHaveTextContent('wilson')
    expect(client.getQueryData(['private'])).toBe('dato protegido')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
