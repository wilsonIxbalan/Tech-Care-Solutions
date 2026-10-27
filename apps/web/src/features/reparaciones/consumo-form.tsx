import { useState } from 'react'
import { z } from 'zod'
import type { InventarioDto } from '@/types/domain'
import { ApiSelector } from '@/features/ordenes/api-selector'
import { ServiceForm } from '@/features/ordenes/service-form'
import { cantidadConsumoSchema } from './reparacion-schema'

export function ConsumoForm({ idReparacion, onCancel }: { idReparacion: number; onCancel: () => void }) {
  const [stock, setStock] = useState<InventarioDto | null>(null)
  const [resultStock, setResultStock] = useState<number | null>(null)
  const schema = z.object({ cantidad: cantidadConsumoSchema.refine(cantidad => Boolean(stock && Number.isSafeInteger(stock.existencia) && stock.existencia >= cantidad), 'La cantidad supera la existencia consultada o el stock no es verificable.') })
  return <ServiceForm title="Consumir repuesto" path={`/reparaciones/${idReparacion}/repuestos`} schema={schema} confirm submitLabel="Registrar consumo" onCancel={onCancel} blocked={!stock}
    onSuccess={data => { setResultStock(data.existenciaResultante as number); setStock(null) }}
    fields={[{ name: 'cantidad', label: 'Cantidad', required: true, inputMode: 'numeric' }]}
    body={values => ({ idBodega: stock?.idBodega, idRepuesto: stock?.idRepuesto, cantidad: values.cantidad })}>
    <ApiSelector<InventarioDto> path="/inventario" label="Existencia" selected={stock} valueOf={s => `${s.idBodega}-${s.idRepuesto}`} labelOf={s => `${s.bodegaNombre} · ${s.codigoRepuesto} · ${s.repuestoNombre} · Existencia: ${s.existencia}`} onSelect={setStock} />
    {stock && <p>Existencia consultada: {stock.existencia}. La disponibilidad se comprueba al registrar el consumo; se conserva el precio aplicado en ese momento.</p>}
    {resultStock !== null && <p>Existencia resultante de este movimiento: {resultStock}.</p>}
  </ServiceForm>
}
