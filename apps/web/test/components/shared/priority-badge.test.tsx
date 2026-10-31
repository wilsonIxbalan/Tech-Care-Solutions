import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PriorityBadge } from '@/components/shared/priority-badge'

describe('PriorityBadge', () => {
  it.each([
    ['baja', 'Baja'], ['NORMAL', 'Normal'], ['Álta', 'Alta'], ['urgente', 'Urgente'],
  ])('presenta %s con texto visible', (priority, label) => {
    render(<PriorityBadge priority={priority} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('acepta objetos y conserva un valor desconocido como texto', () => {
    const { rerender } = render(<PriorityBadge priority={{ codigo: 'ALTA', nombre: 'Alta' }} />)
    expect(screen.getByText('Alta')).toBeInTheDocument()
    rerender(<PriorityBadge priority={{ codigo: 'ESPECIAL', nombre: 'Atención especial' }} />)
    expect(screen.getByText('Atención especial')).toBeInTheDocument()
  })
})
