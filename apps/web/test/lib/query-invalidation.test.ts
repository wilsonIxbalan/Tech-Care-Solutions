import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { invalidateRelatedQueries } from '@/lib/query-invalidation'

describe('dependencias de caché', () => {
  it('servicios invalidan movimientos reales y ambas consultas de facturación', async () => {
    const client = new QueryClient()
    const keys = [['inventario/movimientos', 1, {}], ['facturacion-ordenes', 1, {}], ['facturacion-resumen', 1, 42, '12'], ['ordenes', 1, 'detalle', 42], ['reportes-lookup', 1, 'ordenes', '', 1]]
    keys.forEach(key => client.setQueryData(key, 'anterior'))
    client.setQueryData(['session'], 'usuario')
    await invalidateRelatedQueries(client, 'service')
    keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true))
    expect(client.getQueryState(['session'])?.isInvalidated).toBe(false)
  })
  it('cambios de usuarios revalidan la sesion actual sin guardar roles viejos', async () => {
    const client = new QueryClient()
    client.setQueryData(['session'], { idUsuario: 1 })
    await invalidateRelatedQueries(client, 'users')
    expect(client.getQueryState(['session'])?.isInvalidated).toBe(true)
  })
  it.each(['customers', 'equipment', 'supply', 'users', 'warehouses'] as const)('%s refresca lookups y catálogos inactivos', async group => {
    const client = new QueryClient()
    const keys = [['reportes-lookup', 1, 'tecnicos', '', 1], ['reportes-catalogos', 1], ['catalogos']]
    keys.forEach(key => client.setQueryData(key, 'anterior'))
    await invalidateRelatedQueries(client, group)
    keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true))
  })
})
