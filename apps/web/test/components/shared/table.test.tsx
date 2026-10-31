import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

describe('Table disclosure', () => {
  it('inicia abierto, conserva la tabla en el DOM y usa un summary operable', () => {
    render(<Table containerLabel="Clientes"><caption>Listado de clientes</caption><TableBody><TableRow><TableCell>Ana</TableCell></TableRow></TableBody></Table>)
    const summary = screen.getByText('Clientes').closest('summary')
    const details = summary?.closest('details')
    expect(details).toHaveAttribute('open')
    expect(screen.getByRole('table', { name: 'Listado de clientes' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Clientes' })).toHaveAttribute('tabindex', '0')
    summary?.focus()
    expect(summary).toHaveFocus()
    fireEvent.click(summary!)
    expect(details).not.toHaveAttribute('open')
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })
})
