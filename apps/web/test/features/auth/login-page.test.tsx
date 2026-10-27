import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '@/features/auth/login-page'
import { ApiError } from '@/lib/api-client'
import { renderWithSession } from '../../support/session'

afterEach(() => vi.restoreAllMocks())

function renderLogin(signIn = vi.fn().mockResolvedValue(undefined)) {
  renderWithSession(<LoginPage />, { user: null, signIn })
  return signIn
}
describe('inicio de sesión', () => {
  it('presenta acceso profesional sin mensajes técnicos ni enlaces de demostración', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    expect(screen.getByText('Acceso exclusivo para personal autorizado')).toBeVisible()
    expect(screen.queryByText(/pendiente de conectar|borrador|API|JWT/)).not.toBeInTheDocument()
  })
  it.each(['', '   '])('valida los campos obligatorios y enfoca el identificador %j', async value => {
    const signIn = renderLogin()
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Escribe tu usuario o correo.')).toBeVisible()
    expect(screen.getByText('Escribe tu contraseña.')).toBeVisible()
    expect(screen.getByLabelText('Usuario o correo')).toHaveAccessibleDescription('Escribe tu usuario o correo.')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(screen.getByLabelText('Usuario o correo')).toHaveFocus())
    expect(signIn).not.toHaveBeenCalled()
  })
  it('muestra y oculta contraseña conservando sus espacios', () => {
    renderLogin()
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
  it.each(['wilson', 'wilson@example.com'])('envía %s como nombreUsuario, sin alterar password ni persistir secretos', async value => {
    const signIn = renderLogin()
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: ` ${value} ` } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: ' clave ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ nombreUsuario: value, password: ' clave ' }))
    expect(storage).not.toHaveBeenCalled()
  })
  it('muestra credenciales incorrectas sin perder entradas, y limpia el aviso al editar', async () => {
    renderLogin(vi.fn().mockRejectedValue(new ApiError('No revelar detalles', 'CREDENCIALES_INVALIDAS', 401)))
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'wilson' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.')
    expect(screen.getByLabelText('Usuario o correo')).toHaveValue('wilson')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('password')
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'otro' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('acepta identificador de 120 caracteres y rechaza uno de 121', async () => {
    const signIn = renderLogin()
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'a'.repeat(121) } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Usa hasta 120 caracteres.')).toBeVisible()
    expect(signIn).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'a'.repeat(120) } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ nombreUsuario: 'a'.repeat(120), password: 'password' }))
  })
  it('aplica validaciones del servidor y bloquea envío duplicado mientras espera', async () => {
    let reject!: (error: Error) => void
    const signIn = renderLogin(vi.fn(() => new Promise<void>((_, fail) => { reject = fail })))
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'wilson' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ingresando…' })).toBeDisabled())
    reject(new ApiError('Revisa los campos.', 'VALIDACION', 400, 'test', { nombreUsuario: ['Identificador inválido.'] }))
    expect(await screen.findByText('Identificador inválido.')).toBeVisible()
    expect(signIn).toHaveBeenCalledTimes(1)
  })
  it('respeta el maximo de contraseña del backend sin recortarla', async () => {
    const signIn = renderLogin()
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: 'wilson' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a'.repeat(129) } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Usa hasta 128 caracteres.')).toBeVisible()
    expect(signIn).not.toHaveBeenCalled()
    const password = ` ${'a'.repeat(126)} `
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ nombreUsuario: 'wilson', password }))
  })
})
