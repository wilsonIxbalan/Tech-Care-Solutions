import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { adminUser, json } from '../support/session'

const dashboard = { ordenesAbiertas: 12, ordenesEnDiagnostico: 3, ordenesEnReparacion: 4, ordenesListas: 5, facturasConSaldo: 2, repuestosBajoMinimo: 0, actividadReciente: [] }
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/auth/me')) return json({ data: adminUser })
    if (url.endsWith('/dashboard')) return json({ data: dashboard })
    if (url.includes('/usuarios?')) return json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
    if (/\/(clientes|equipos|ordenes|facturas|compras|proveedores|repuestos|bodegas|inventario(?:\/movimientos)?)(?:\?|$)/.test(url)) return json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
    if (url.endsWith('/catalogos')) return json({ data: { roles: [{ codigo: 'ADMINISTRADOR', nombre: 'Administrador' }], tiposEquipo: [], marcas: [], prioridades: [], tecnicos: [], estadosOrden: [], categoriasRepuesto: [], tiposMovimiento: [], metodosPago: [] } })
    throw new Error(`Consulta inesperada: ${url}`)
  }))
})
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); vi.unstubAllGlobals() })

describe('navegación y sesión de Tech Care Solutions', () => {
  it('espera la sesión sin mostrar datos privados y redirige a login con un único me=401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'SESION_INVALIDA', message: 'Inicia sesión.' }, requestId: 'test' }, 401)))
    window.history.replaceState({}, '', '/usuarios')
    render(<App />)
    expect(screen.getByText('Verificando tu sesión…')).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe('/login')
  })
  it('consulta indicadores reales, muestra roles e iniciales sin estados ficticios', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Bienvenido, Wilson' })).toBeVisible()
    const indicators = within(await screen.findByLabelText('Indicadores de operación'))
    expect(await indicators.findByText('12')).toBeVisible()
    expect(indicators.getByText('0')).toBeVisible()
    expect(screen.getByRole('img', { name: /Órdenes por etapa/ })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Flujo de servicio' })).toBeVisible()
    expect(screen.getByText('Sin actividad reciente')).toBeVisible()
    expect(screen.getByText('WP')).toBeVisible()
    expect(screen.getAllByText('Administrador').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Frontend →|Proyecto académico|En desarrollo|En línea|Una misma base|Kit visual/)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })
  it.each([
    ['/clientes', 'Clientes'], ['/equipos', 'Equipos'],
    ['/ordenes', 'Órdenes de servicio'], ['/diagnosticos', 'Diagnósticos y reparaciones'],
    ['/repuestos', 'Repuestos'], ['/proveedores', 'Proveedores'], ['/inventario', 'Inventario y movimientos'],
    ['/compras', 'Compras'], ['/facturacion', 'Facturación y pagos'], ['/entregas', 'Entregas y cierre'], ['/reportes', 'Reportes'],
  ])('navega a %s con sesion autorizada', async (path, title) => {
    window.history.replaceState({}, '', path)
    render(<App />)
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
    expect(screen.getByRole('link', { name: title })).toHaveAttribute('aria-current', 'page')
  })
  it('bloquea acceso directo de no administrador y oculta el enlace de usuarios', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: { ...adminUser, roles: ['TECNICO'] } })))
    window.history.replaceState({}, '', '/usuarios')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Acceso restringido' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Usuarios y roles' })).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('inicia sesión por cookie, vuelve a la ruta solicitada y cierra sesión sin conservar el shell', async () => {
    let loggedIn = false
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/auth/login')) { loggedIn = true; return json({ data: { usuario: adminUser, expiresIn: 3600 } }) }
      if (url.endsWith('/auth/logout')) { loggedIn = false; return json({ data: { message: 'Sesión cerrada.' } }) }
      if (loggedIn && /\/(clientes|equipos)(?:\?|$)/.test(url)) return json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
      return loggedIn ? json({ data: adminUser }) : json({ error: { code: 'SESION_INVALIDA', message: 'Inicia sesión.' }, requestId: 'test' }, 401)
    }))
    window.history.replaceState({}, '', '/clientes')
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Usuario o correo'), { target: { value: 'wilson@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeVisible()
    expect(window.location.pathname).toBe('/clientes')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(loggedIn).toBe(false)
  })
  it.each(['/clientes', '/equipos', '/ordenes', '/diagnosticos', '/repuestos', '/inventario', '/proveedores', '/compras', '/facturacion', '/entregas', '/reportes', '/usuarios'])('protege la URL directa %s sin depender del menú', async path => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: { ...adminUser, roles: ['TECNICO'], permisos: [] } })))
    window.history.replaceState({}, '', path)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Acceso restringido' })).toBeVisible()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('link').every(link => link.getAttribute('href') === '/dashboard')).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('contrae el menú lateral, lo persiste y conserva nombres accesibles', async () => {
    localStorage.removeItem('techcare.sidebar')
    window.history.replaceState({}, '', '/clientes')
    render(<App />)
    const toggle = await screen.findByRole('button', { name: 'Contraer menú' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false')
    expect(localStorage.getItem('techcare.sidebar')).toBe('collapsed')
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menú' }))
    expect(localStorage.getItem('techcare.sidebar')).toBe('expanded')
  })
  it('muestra rol y permisos del usuario', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Ver tu rol y permisos/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Tu rol y permisos' })
    expect(within(dialog).getByText('Puedes:')).toBeVisible()
    expect(within(dialog).getByText('Gestionar clientes')).toBeVisible()
    expect(within(dialog).getByText('No disponible para tu rol:')).toBeVisible()
    expect(within(dialog).getByText(/Gestionar usuarios y roles/)).toBeVisible()
  })
  it('abre el menú móvil, navega y devuelve el foco', async () => {
    render(<App />)
    const trigger = await screen.findByRole('button', { name: 'Abrir menú' })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Menú TechCare' })
    fireEvent.click(within(dialog).getByRole('link', { name: 'Clientes' }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeVisible()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
  it.each(['botón', 'Escape'])('cierra el menú mediante %s', async method => {
    render(<App />)
    const trigger = await screen.findByRole('button', { name: 'Abrir menú' })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Menú TechCare' })
    if (method === 'botón') fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar menú' }))
    else fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
  it('vuelve al inicio desde ruta desconocida', async () => {
    window.history.replaceState({}, '', '/no-existe')
    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Volver al inicio' }))
    expect(await screen.findByRole('heading', { name: 'Bienvenido, Wilson' })).toBeVisible()
  })
  it('mantiene el kit fuera de la navegación de negocio', async () => {
    window.history.replaceState({}, '', '/kit')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Esto es un kit, no un dashboard de negocio' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Kit visual' })).not.toBeInTheDocument()
  })
  it('no reintenta dashboard 403 ni muestra indicadores inventados', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/auth/me') ? json({ data: adminUser }) : json({ error: { code: 'PERMISO_DENEGADO', message: 'No tienes permiso para esta acción.' }, requestId: 'test' }, 403)))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso')
    expect(screen.queryByLabelText('Indicadores de operación')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
