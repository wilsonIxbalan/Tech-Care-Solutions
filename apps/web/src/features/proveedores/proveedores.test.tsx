import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProveedoresPage } from './proveedores-page'
import { proveedorSchema } from './proveedor-schema'

describe('proveedores', () => {
  it('rechaza obligatorios vacíos, respeta longitudes y permite contacto y correo opcionales', () => {
    const valid = { nit: 'Prueba', nombre: 'Proveedor de prueba', telefono: 'Texto', nombreContacto: '', email: '', direccion: '' }
    expect(proveedorSchema.safeParse(valid).success).toBe(true)
    for (const patch of [{ nit: '  ' }, { nombre: '  ' }, { telefono: '  ' }, { telefono: '1'.repeat(21) }, { email: 'inválido' }]) expect(proveedorSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
  it('muestra errores asociados y limpia al cancelar', async () => {
    render(<ProveedoresPage />)
    const trigger = screen.getByRole('button', { name: 'Preparar proveedor' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Validar datos' }))
    expect(await screen.findAllByRole('alert')).toHaveLength(3)
    expect(screen.getByLabelText('NIT *')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('NIT *')).toHaveValue('')
  })
})
