import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tooltip } from '@/components/ui/tooltip'

beforeEach(() => vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
}))
afterEach(() => vi.unstubAllGlobals())

describe('Ayuda contextual accesible', () => {
  it('se muestra al enfocar con teclado y desaparece al salir', async () => {
    render(<Tooltip content="Cerrar la sesión actual"><button>Salir</button></Tooltip>)
    const button = screen.getByRole('button', { name: 'Salir' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    act(() => button.focus())
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Cerrar la sesión actual')
    expect(button).toHaveAccessibleDescription('Cerrar la sesión actual')
    act(() => button.blur())
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  })
})
