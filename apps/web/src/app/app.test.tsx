import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '@/app/app'

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })

describe('navegación de TechCare', () => {
  it('abre un módulo y distingue su estado pendiente', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Servicio técnico, de principio a fin' })).toBeVisible()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name: 'Clientes' }))
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Módulo pendiente de implementación' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
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
