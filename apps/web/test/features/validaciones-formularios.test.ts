import { describe, expect, it } from 'vitest'
import { usuarioSchema } from '@/features/usuarios/usuario-model'
import { createRepuestoSchema } from '@/features/repuestos/repuesto-model'
import { createFacturacionSchema } from '@/features/facturacion/facturacion-schema'
import { createEntregaSchema } from '@/features/entregas/entrega-schema'

describe('validaciones de formularios', () => {
  it('usuario: sin espacios en el usuario y teléfono guatemalteco opcional', () => {
    const base = { nombreUsuario: 'ana.perez', nombreCompleto: 'Ana', email: 'ana@techcare.test', telefono: '', activo: '1', password: '', roles: ['CAJA'] }
    expect(usuarioSchema.safeParse(base).success).toBe(true)
    expect(usuarioSchema.safeParse({ ...base, nombreUsuario: 'ana perez' }).success).toBe(false)
    expect(usuarioSchema.safeParse({ ...base, telefono: '2222-3333' }).success).toBe(true)
    expect(usuarioSchema.safeParse({ ...base, telefono: '123' }).success).toBe(false)
  })
  it('repuesto: el precio de venta no puede ser menor que la compra', () => {
    const schema = createRepuestoSchema([{ idCategoria: 1, nombre: 'C' }])
    const base = { idCategoria: '1', codigo: 'R1', nombre: 'Repuesto', descripcion: '', precioCompraReferencia: '10.50', precioVenta: '10.50' }
    expect(schema.safeParse(base).success).toBe(true)
    expect(schema.safeParse({ ...base, precioVenta: '10.49' }).success).toBe(false)
  })
  it('facturación: NIT válido o vacío', () => {
    const schema = createFacturacionSchema([{ idOrden: 2, numeroOrden: 'OS-2', estado: 'LISTO' }])
    const base = { idOrden: '2', nitFacturacion: '', nombreFacturacion: '', direccionFacturacion: '' }
    expect(schema.safeParse(base).success).toBe(true)
    expect(schema.safeParse({ ...base, nitFacturacion: '1234567-9' }).success).toBe(true)
    expect(schema.safeParse({ ...base, nitFacturacion: '1234567-1' }).success).toBe(false)
  })
  it('entrega: nombre con letras y DPI de 13 dígitos', () => {
    const schema = createEntregaSchema([{ idOrden: 21, numeroOrden: 'OS-21', estado: 'LISTO', factura: { idFactura: 1, idOrden: 21, estado: 'PAGADA', saldo: '0.00' } }])
    const base = { idOrden: '21', nombreRecibe: "José O'Brien-Pérez", documentoRecibe: '1234 56789 0101', observaciones: '' }
    expect(schema.safeParse(base).success).toBe(true)
    expect(schema.safeParse({ ...base, nombreRecibe: 'Juan 123' }).success).toBe(false)
    expect(schema.safeParse({ ...base, documentoRecibe: '12345' }).success).toBe(false)
  })
})
