import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { TextField, AreaField, SelectField } from '@/components/shared/form-fields'
import { DraftActions, DraftSection } from '@/components/shared/draft-section'
import { ReceivedTable } from '@/components/shared/received-table'

beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {}; unobserve() {}; disconnect() {} }))
afterAll(() => vi.unstubAllGlobals())

describe('contratos de componentes compartidos', () => {
  it('conserva referencias, atributos y descripciones del módulo junto a ayuda y error', () => {
    const ref = createRef<HTMLInputElement>()
    render(<><p id="regla">Regla del módulo</p>
      <TextField ref={ref} id="importe" label="Importe" type="text" inputMode="decimal" required maxLength={13} help="Dos decimales" error="Importe inválido" aria-describedby="regla" />
      <AreaField id="notas" label="Notas" aria-describedby="regla" aria-invalid="true" maxLength={500} />
      <SelectField id="rol" label="Rol" options={[{ value: '3', label: 'Rol recibido' }]} className="w-48" help="Ayuda de selección" error="Selección inválida" aria-describedby="regla" />
    </>)
    expect(ref.current).toBe(screen.getByLabelText('Importe *'))
    expect(ref.current).toHaveAttribute('inputmode', 'decimal')
    expect(ref.current).toHaveAttribute('maxlength', '13')
    expect(ref.current).toHaveAccessibleDescription('Regla del módulo Dos decimales Máximo 13 caracteres. Importe inválido')
    expect(screen.getByLabelText('Notas')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Notas')).toHaveAccessibleDescription('Regla del módulo Máximo 500 caracteres.')
    expect(screen.getByLabelText('Rol')).toHaveAccessibleDescription('Regla del módulo Ayuda de selección Selección inválida')
    expect(screen.getByLabelText('Rol')).toHaveClass('w-48')
  })
  it('expone la ayuda de límite con foco y toque, y permite cerrarla con Escape', async () => {
    render(<TextField id="nombre" label="Nombre" maxLength={80} />)
    const help = screen.getByRole('button', { name: 'Ayuda para Nombre' })
    fireEvent.focus(help)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Máximo 80 caracteres.')
    fireEvent.keyDown(help, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.click(help)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Máximo 80 caracteres.')
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Máximo 80 caracteres.')
  })
  it('distingue selección sin conectar de catálogo recibido vacío y explica el botón bloqueado', () => {
    const { rerender } = render(<SelectField id="catalogo" label="Catálogo" />)
    expect(screen.getByLabelText('Catálogo')).toHaveAccessibleDescription('Catálogo pendiente de conexión.')
    rerender(<><SelectField id="catalogo" label="Catálogo" options={[]} /><DraftActions blocked blockedReason="La orden recibida tiene saldo pendiente." message="" onCancel={() => {}} /></>)
    expect(screen.getByRole('option')).toHaveTextContent('Sin opciones disponibles')
    expect(screen.getByRole('button', { name: 'Validar datos' })).toHaveAccessibleDescription('La orden recibida tiene saldo pendiente.')
  })
  it('abre el primer campo disponible y devuelve el foco al cancelar', () => {
    render(<DraftSection title="Prueba de apertura" action="Abrir formulario">{cancel => <form><SelectField id="sin-catalogo" label="Catálogo" /><TextField id="nombre" label="Nombre" /><DraftActions message="" onCancel={cancel} /></form>}</DraftSection>)
    const trigger = screen.getByRole('button', { name: 'Abrir formulario' })
    fireEvent.click(trigger)
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
  })
  it('no confunde conexión pendiente, carga, error y éxito vacío; conserva nulo y cero en una tabla accesible', () => {
    const props = { caption: 'Datos recibidos', rowKey: (r: { id: number; value: number | null }) => r.id, columns: [{ title: 'Valor', cell: (r: { id: number; value: number | null }) => r.value }] }
    const { rerender } = render(<ReceivedTable {...props} />)
    expect(screen.queryByText('Consulta sin resultados')).not.toBeInTheDocument()
    rerender(<ReceivedTable {...props} state={{ status: 'loading' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Consultando')
    rerender(<ReceivedTable {...props} state={{ status: 'error', message: 'Error recibido' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Error recibido')
    rerender(<ReceivedTable {...props} state={{ status: 'success', data: [] }} />)
    expect(screen.getByText('Consulta sin resultados')).toBeVisible()
    rerender(<ReceivedTable {...props} state={{ status: 'success', data: [{ id: 1, value: null }, { id: 2, value: 0 }] }} />)
    expect(screen.getByRole('region', { name: 'Tabla: Datos recibidos' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('table')).toHaveTextContent('—')
    expect(screen.getByRole('table')).toHaveTextContent('0')
  })
})
