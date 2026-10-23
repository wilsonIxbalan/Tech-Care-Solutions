import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '@/features/auth/login-page'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('login pendiente de conexión', () => {
  it('explica el pendiente antes de interactuar y ofrece únicamente validar campos', () => {
    render(<LoginPage />)
    expect(screen.getByText(/La autenticación está pendiente de conectar la API/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Validar datos' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
  })

  it.each(['', '   '])('muestra errores en español y enfoca el usuario obligatorio con valor %j', async username => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: username } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))

    expect(await screen.findByText('Escribe tu usuario.')).toBeVisible()
    expect(screen.getByText('Escribe tu contraseña.')).toBeVisible()
    expect(screen.getByLabelText('Usuario')).toHaveAccessibleDescription('Escribe tu usuario.')
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('Escribe tu contraseña.')
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(screen.getByLabelText('Usuario')).toHaveFocus())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('permite mostrar y ocultar la contraseña sin alterar su valor', () => {
    render(<LoginPage />)
    const password = screen.getByLabelText('Contraseña')
    fireEvent.change(password, { target: { value: ' clave de prueba ' } })
    expect(password).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveValue(' clave de prueba ')
  })

  it('valida sin autenticar, navegar ni persistir y limpia el mensaje al editar', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const originalPath = window.location.pathname
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'usuario-de-prueba' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-de-prueba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))

    expect(await screen.findByRole('status')).toHaveTextContent('No se ha iniciado ninguna sesión: falta conectar la API.')
    expect(window.location.pathname).toBe(originalPath)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(xhrSend).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'otro-usuario-de-prueba' } })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
