import { useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { formatMoney } from '@/lib/format'
import type { FacturaDetalleDto } from '@/types/domain'
import { useMetodosPago, useOrdenFacturacion } from './api'
import { admiteBorradorPago } from './facturacion-schema'
import { PagoForm } from './pago-form'
import { AnularPagoForm } from './anular-pago-form'

export function PagosFactura({ factura, fresh }: { factura: FacturaDetalleDto; fresh: boolean }) {
  const [editor, setEditor] = useState<'pago' | number | null>(null)
  const pending = useIsMutating({ mutationKey: ['facturacion-write'] }) > 0
  const metodos = useMetodosPago(editor === 'pago')
  const orden = useOrdenFacturacion(factura.idOrden, 'PAGOS_REGISTRAR')
  const canCancel = fresh && orden.isSuccess && !orden.isFetching && !orden.data.entrega && orden.data.estado !== 'ENTREGADO'
  const pago = typeof editor === 'number' ? factura.pagos.find(item => item.idPago === editor) : undefined
  return <section aria-label="Operaciones de caja" className="space-y-4 rounded-xl border bg-card p-4">
    <h3 className="font-semibold">Operaciones de caja</h3>
    <div className="flex flex-wrap gap-3">{admiteBorradorPago(factura) && <Button disabled={!fresh || editor !== null || pending} onClick={() => setEditor('pago')}>Nuevo pago</Button>}
      {factura.pagos.filter(item => item.estado === 'APLICADO').map(item => <Button key={item.idPago} variant="outline" disabled={!canCancel || editor !== null || pending} onClick={() => setEditor(item.idPago)}>Anular pago #{item.idPago} · {formatMoney(item.monto)}</Button>)}
    </div>
    {orden.isPending ? <LoadingState label="Comprobando estado de la orden…" /> : orden.isError ? <ErrorState description={orden.error.message} onRetry={() => void orden.refetch()} /> : (orden.data.entrega || orden.data.estado === 'ENTREGADO') && <p className="text-sm text-muted-foreground">La orden ya fue entregada. No se permite anular sus pagos.</p>}
    {editor === 'pago' && <>
      {metodos.isPending ? <LoadingState label="Consultando métodos de pago…" /> : metodos.isError ? <ErrorState description={metodos.error.message} onRetry={() => void metodos.refetch()} /> : null}
      <PagoForm facturas={[factura]} metodos={metodos.data ?? []} enabled={fresh && metodos.isSuccess && !metodos.isFetching} onCancel={() => setEditor(null)} onSaved={() => setEditor(null)} />
    </>}
    {pago && <AnularPagoForm pago={pago} idOrden={factura.idOrden} allowed={canCancel} onCancel={() => setEditor(null)} onSaved={() => setEditor(null)} />}
  </section>
}
