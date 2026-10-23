import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '@/app/app'

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })

describe('navegación de TechCare', () => {
  it('abre Clientes y muestra que la consulta aún no está conectada', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Servicio técnico, de principio a fin' })).toBeVisible()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name: 'Clientes' }))
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Consulta de clientes pendiente de conexión' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
  })
  it('mantiene los otros módulos en su pantalla pendiente', () => {
    window.history.replaceState({}, '', '/equipos')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Equipos' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Módulo pendiente de implementación' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Equipos' })).toHaveAttribute('aria-current', 'page')
  })
  it('abre el login fuera del menú, la cabecera y el pie de AppShell', () => {
    window.history.replaceState({}, '', '/login')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })
  it('conserva el kit en una ruta propia', async () => {
    window.history.replaceState({}, '', '/kit')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Esto es un kit, no un dashboard de negocio' })).toBeVisible()
  })
  it('permite volver al inicio desde una ruta desconocida', () => {
    window.history.replaceState({}, '', '/no-existe')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Esta pantalla no existe' })).toBeVisible()
    fireEvent.click(screen.getByRole('link', { name: 'Volver al inicio' }))
    expect(screen.getByRole('heading', { name: 'Servicio técnico, de principio a fin' })).toBeVisible()
  })
})
