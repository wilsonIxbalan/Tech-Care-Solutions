import { describe, expect, it } from 'vitest'
import { clienteSchema } from '@/features/clientes/cliente-schema'

const commonValues = { nit: 'CF', telefono: '+502 2222-3333', email: '', direccion: '' }

describe('resultado validado de Clientes', () => {
  it('recorta espacios y excluye los campos empresariales de un individual', () => {
    const result = clienteSchema.parse({
      ...commonValues,
      tipoCliente: 'INDIVIDUAL',
      nombres: '  Ana  ',
      apellidos: '  Pérez  ',
      nit: '  CF  ',
      telefono: '  +502 2222-3333  ',
      email: '  contacto@example.test  ',
      direccion: '  Zona 1  ',
      razonSocial: 'x'.repeat(151),
      nombreContacto: 'x'.repeat(121),
    })

    expect(result).toEqual({
      tipoCliente: 'INDIVIDUAL',
      nombres: 'Ana',
      apellidos: 'Pérez',
      nit: 'CF',
      telefono: '+502 2222-3333',
      email: 'contacto@example.test',
      direccion: 'Zona 1',
    })
  })

  it('excluye nombres y apellidos de un empresarial y permite omitir el contacto', () => {
    const result = clienteSchema.parse({
      ...commonValues,
      tipoCliente: 'EMPRESARIAL',
      razonSocial: '  Empresa de prueba  ',
      nombres: 'x'.repeat(101),
      apellidos: 'x'.repeat(101),
    })

    expect(result).toEqual({
      ...commonValues,
      tipoCliente: 'EMPRESARIAL',
      razonSocial: 'Empresa de prueba',
    })
  })

  it.each(['nit', 'telefono'])('respeta el límite existente de 20 caracteres de %s sin imponer un formato', field => {
    const values = { ...commonValues, tipoCliente: 'INDIVIDUAL', nombres: 'Ana', apellidos: 'Pérez' }
    expect(clienteSchema.safeParse({ ...values, [field]: 'x'.repeat(20) }).success).toBe(true)
    const result = clienteSchema.safeParse({ ...values, [field]: 'x'.repeat(21) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual([field])
  })
})
