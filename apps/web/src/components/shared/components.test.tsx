import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { ErrorState } from '@/components/shared/states'

describe('shared interaction patterns', () => {
  it('shows status in text instead of color alone', () => {
    render(<StatusBadge state="ESPERANDO_AUTORIZACION" />)
    expect(screen.getByText('Esperando autorización')).toBeVisible()
  })
  it('exposes a retry action for reads', () => {
    const retry = vi.fn()
    render(<ErrorState description="Error de ejemplo" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }))
    expect(retry).toHaveBeenCalledOnce()
  })
  it('does not run an action before explicit confirmation', async () => {
    const confirm = vi.fn()
    render(<ConfirmDialog title="Ejemplo" description="Sin cambios reales" trigger={<Button>Abrir prueba</Button>} onConfirm={confirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir prueba' }))
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('keeps an ambiguous failed result visible', async () => {
    render(<ConfirmDialog title="Ejemplo" description="Sin cambios reales" trigger={<Button>Abrir prueba</Button>} onConfirm={() => Promise.reject(new Error('private detail'))} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Consulta el estado'))
    expect(screen.queryByText('private detail')).not.toBeInTheDocument()
  })
})
