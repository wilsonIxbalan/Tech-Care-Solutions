import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DesignSystemPage } from '@/features/design-system/design-system-page'

describe('starter gallery', () => {
  it('makes its non-business status explicit', () => {
    render(<DesignSystemPage />)
    expect(screen.getByRole('heading', { name: 'Esto es un kit, no un dashboard de negocio' })).toBeVisible()
    expect(screen.getByText('Esperando autorización')).toBeVisible()
    expect(screen.getByText('components/ui/button.tsx')).toBeVisible()
  })
  it('validates the example form inline', async () => {
    render(<DesignSystemPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Validar ejemplo' }))
    expect(await screen.findByText('Escribe al menos 3 caracteres.')).toBeVisible()
    expect(await screen.findByText('Escribe un correo válido.')).toBeVisible()
    expect(screen.getByLabelText(/Nombre de referencia/)).toHaveAttribute('aria-invalid', 'true')
  })
})
