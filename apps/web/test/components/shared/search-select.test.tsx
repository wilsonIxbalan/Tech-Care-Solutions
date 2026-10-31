import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchSelect } from '@/components/shared/search-select'
import { useDebouncedValue } from '@/lib/use-debounced-value'

afterEach(() => { vi.useRealTimers() })
const base = { id: 'x', label: 'Cliente', valueOf: (r: { id: number }) => r.id, labelOf: (r: { id: number; n: string }) => r.n, onSearch: () => {}, onSelect: () => {} }

describe('SearchSelect', () => {
  it('muestra buscando, vacío, cargar más y permite quitar la selección', () => {
    const more = vi.fn(); const select = vi.fn()
    const { rerender } = render(<SearchSelect {...base} selected={null} rows={[]} search="zzz" loading onLoadMore={more} hasMore onSelect={select} />)
    expect(screen.getByText('Buscando…')).toBeVisible()
    rerender(<SearchSelect {...base} selected={null} rows={[]} search="zzz" onLoadMore={more} hasMore onSelect={select} />)
    expect(screen.getByText('Sin resultados para «zzz»')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más resultados' }))
    expect(more).toHaveBeenCalledTimes(1)
    rerender(<SearchSelect {...base} selected={{ id: 1, n: 'Ana' }} rows={[{ id: 1, n: 'Ana' }]} search="" onSelect={select} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección de cliente' }))
    expect(select).toHaveBeenCalledWith(null)
  })
  it('marca el campo obligatorio con asterisco decorativo', () => {
    render(<SearchSelect {...base} selected={null} rows={[]} search="" required />)
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toBeRequired()
  })
})

describe('useDebouncedValue', () => {
  it('espera 300 ms antes de publicar el último valor', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), { initialProps: { value: 'a' } })
    rerender({ value: 'ab' })
    expect(result.current).toBe('a')
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('ab')
  })
})
