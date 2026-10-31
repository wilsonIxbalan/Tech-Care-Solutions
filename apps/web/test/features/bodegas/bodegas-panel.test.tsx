import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BodegasPanel } from '@/features/bodegas/bodegas-panel'
import { adminUser, json, renderWithSession } from '../../support/session'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Mantenimiento de bodegas sin SQL', () => {
  it.each(['TECNICO', 'RECEPCION', 'CAJA'] as const)('no ofrece gestion a %s ni consulta el endpoint', role => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    renderWithSession(<BodegasPanel />, { user: { ...adminUser, roles: [role] } })
    expect(screen.queryByRole('button', { name: 'Administrar bodegas' })).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('consulta bajo demanda sin enviar una busqueda vacia', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })))
    renderWithSession(<BodegasPanel />)
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Administrar bodegas' }))
    expect(await screen.findByText('No hay bodegas para estos filtros')).toBeVisible()
    expect(fetch).toHaveBeenCalledWith('/api/v1/bodegas?page=1&pageSize=5', expect.objectContaining({ credentials: 'include' }))
  })

  it('valida y crea por POST sin inventar existencias o movimientos', async () => {
    const row = { idBodega: 3, codigo: 'B-01', nombre: 'Principal', ubicacion: null, estado: 'ACTIVA' }
    const calls = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST' ? json({ data: row }, 201) : json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }))
    vi.stubGlobal('fetch', calls)
    renderWithSession(<BodegasPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Administrar bodegas' }))
    await screen.findByText('No hay bodegas para estos filtros')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva bodega' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar bodega' }))
    expect(await screen.findByText('Escribe el código.')).toBeVisible()
    expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    fireEvent.change(screen.getByLabelText(/^Código de bodega/), { target: { value: ' B-01 ' } })
    fireEvent.change(screen.getByLabelText(/^Nombre de bodega/), { target: { value: ' Principal ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar bodega' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Crear bodega' })).not.toBeInTheDocument())
    expect(calls).toHaveBeenCalledWith('/api/v1/bodegas', expect.objectContaining({ method: 'POST', body: JSON.stringify({ codigo: 'B-01', nombre: 'Principal', ubicacion: null, estado: 'ACTIVA' }) }))
    expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })

  it('conserva entradas y error de negocio si el codigo esta duplicado', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST' ? json({ error: { code: 'DUPLICADO', message: 'El código ya existe.' }, requestId: 'bodega-test' }, 409) : json({ data: [] })))
    renderWithSession(<BodegasPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Administrar bodegas' }))
    await screen.findByText('No hay bodegas para estos filtros')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva bodega' }))
    fireEvent.change(screen.getByLabelText(/^Código de bodega/), { target: { value: 'B-01' } })
    fireEvent.change(screen.getByLabelText(/^Nombre de bodega/), { target: { value: 'Principal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar bodega' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El código ya existe.')
    expect(screen.getByLabelText(/^Nombre de bodega/)).toHaveValue('Principal')
  })

  it('edita y desactiva por PATCH sin borrar registros', async () => {
    let row = { idBodega: 3, codigo: 'B-01', nombre: 'Principal', ubicacion: null, estado: 'ACTIVA' }
    const calls = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') { row = { ...row, estado: 'INACTIVA' }; return json({ data: row }) }
      return json({ data: [row], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } })
    })
    vi.stubGlobal('fetch', calls)
    renderWithSession(<BodegasPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Administrar bodegas' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Editar bodega B-01' }))
    fireEvent.change(screen.getByLabelText('Estado de bodega'), { target: { value: 'INACTIVA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar bodega' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Editar bodega' })).not.toBeInTheDocument())
    expect(calls).toHaveBeenCalledWith('/api/v1/bodegas/3', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ codigo: 'B-01', nombre: 'Principal', ubicacion: null, estado: 'INACTIVA' }) }))
    expect(calls.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
  })
})
