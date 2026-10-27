import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ServiceForm } from '@/features/ordenes/service-form'
import { json, renderWithSession } from '../../support/session'

const schema = z.object({ descripcion: z.string().trim().min(1, 'Describe la actividad.') })
const fields = [{ name: 'descripcion', label: 'Descripción de la actividad', required: true }]
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Confirmación de operaciones de servicio', () => {
  it('solo confirma éxito con un identificador válido devuelto por la API', async () => {
    const http = vi.fn(async () => json({ data: { idActividad: 17 } }, 201))
    vi.stubGlobal('fetch', http)
    const saved = vi.fn()
    renderWithSession(<ServiceForm title="Registrar actividad" path="/reparaciones/4/actividades" schema={schema} fields={fields} onSuccess={saved} />)
    fireEvent.change(screen.getByLabelText('Descripción de la actividad *'), { target: { value: '  Verificación final  ' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar actividad' }))
    await waitFor(() => expect(saved).toHaveBeenCalledWith({ idActividad: 17 }))
    expect(http).toHaveBeenCalledWith('/api/v1/reparaciones/4/actividades', expect.objectContaining({ method: 'POST', body: '{"descripcion":"Verificación final"}' }))
    expect(screen.getByRole('status')).toHaveTextContent('Operación registrada.')
  })

  it.each(['red', 'respuesta'] as const)('bloquea reenvío si no se confirmó el resultado por %s', async mode => {
    const http = vi.fn(async () => {
      if (mode === 'red') throw new TypeError('offline')
      return json({ data: {} }, 201)
    })
    vi.stubGlobal('fetch', http)
    const saved = vi.fn()
    renderWithSession(<ServiceForm title="Registrar actividad" path="/reparaciones/4/actividades" schema={schema} fields={fields} onSuccess={saved} />)
    fireEvent.change(screen.getByLabelText('Descripción de la actividad *'), { target: { value: 'Verificación final' } })
    const form = screen.getByRole('form', { name: 'Registrar actividad' })
    fireEvent.submit(form)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha confirmado su resultado.')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    fireEvent.submit(form)
    expect(http).toHaveBeenCalledTimes(1)
    expect(saved).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Descripción de la actividad *')).toHaveValue('Verificación final')
  })
})
