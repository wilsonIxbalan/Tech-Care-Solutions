import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DraftSection } from '@/components/shared/draft-section'
import { SelectField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import type { ReceivedData } from '@/lib/received-data'
import type { FacturaDetalleDto } from '@/types/domain'
import { formatMoney } from '@/lib/format'
import { FacturacionForm } from './facturacion-form'
import { PagoForm } from './pago-form'
import { FacturaDetalle } from './factura-detalle'
import type { MetodoPagoOption, OrdenFacturacion } from './facturacion-schema'

export function FacturacionPage({ ordenes, metodos, facturas = { status: 'pending' } }: { ordenes?: readonly OrdenFacturacion[]; metodos?: readonly MetodoPagoOption[]; facturas?: ReceivedData<FacturaDetalleDto> }) {
  const [idFactura, setIdFactura] = useState('')
  const data = facturas.status === 'success' ? facturas.data : undefined
  const selected = data?.find(f => String(f.idFactura) === idFactura)
  return <><PageHeader title="Facturación y pagos" description="Preparación de datos fiscales y borradores de pago. Emisión, cobro y anulación pendientes de integración." />
    <DraftSection title="Datos de facturación" action="Preparar datos de facturación">{cancel => <FacturacionForm ordenes={ordenes} onCancel={cancel} />}</DraftSection>
    <DraftSection title="Pagos" action="Preparar pago">{cancel => <PagoForm facturas={data} metodos={metodos} onCancel={cancel} />}</DraftSection>
    <ReceivedTable state={facturas} caption="Facturas" rowKey={f => f.idFactura} columns={[
      { title: 'Factura', cell: f => f.numeroFactura }, { title: 'Orden', cell: f => f.numeroOrden }, { title: 'Cliente', cell: f => f.clienteNombre }, { title: 'Estado', cell: f => f.estado }, { title: 'Total (Q)', cell: f => formatMoney(f.total) }, { title: 'Pagado (Q)', cell: f => formatMoney(f.totalPagado) }, { title: 'Saldo (Q)', cell: f => formatMoney(f.saldo) },
    ]} />
    <section className="space-y-4" aria-label="Detalle de factura"><h2 className="text-lg font-semibold">Detalle de factura</h2>
      <SelectField id="factura-detalle" label="Ver detalle recibido" options={data?.map(f => ({ value: String(f.idFactura), label: f.numeroFactura }))} value={idFactura} onChange={e => setIdFactura(e.target.value)} />
      {selected && <FacturaDetalle factura={selected} />}
      <p className="text-sm text-muted-foreground">Anulaciones pendientes de integración. Un pago aplicado sólo se anula con motivo y no después de entregar la orden. No se modifican documentos ni saldos desde esta interfaz.</p>
    </section></>
}
