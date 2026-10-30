import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SelectField } from '@/components/shared/form-fields'

const options = [{ value: '10', label: '10' }, { value: '20', label: '20' }]
describe('SelectField: valores vacios segun el uso', () => {
  it('un selector cerrado no ofrece vacio y no propaga un valor invalido', () => {
    const changed = vi.fn()
    render(<SelectField id="size" label="Por página" allowEmpty={false} value="20" options={options} onChange={event => changed(event.target.value)} />)
    const select = screen.getByRole('combobox', { name: 'Por página' }) as HTMLSelectElement
    expect([...select.options].map(option => option.value)).toEqual(['10', '20'])
    fireEvent.change(select, { target: { value: '' } })
    expect(changed).not.toHaveBeenCalled()
    fireEvent.change(select, { target: { value: '10' } })
    expect(changed).toHaveBeenCalledWith('10')
  })
  it('un filtro opcional conserva Todos para limpiar el filtro', () => {
    const changed = vi.fn()
    render(<SelectField id="filter" label="Estado" placeholder="Todos" value="10" options={options} onChange={event => changed(event.target.value)} />)
    expect(screen.getByRole('option', { name: 'Todos' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: '' } })
    expect(changed).toHaveBeenCalledWith('')
  })
  it('una selección obligatoria conserva indicacion inicial pero no permite elegirla', () => {
    render(<SelectField id="required" label="Proveedor" required value="" options={options} onChange={() => {}} />)
    const select = screen.getByRole('combobox', { name: 'Proveedor *' }) as HTMLSelectElement
    const placeholder = select.querySelector('option[value=""]') as HTMLOptionElement
    expect(placeholder.disabled).toBe(true)
    expect(placeholder.hidden).toBe(true)
    expect(select).toHaveValue('')
    expect(select).toBeRequired()
  })
})
