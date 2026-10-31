import { PermissionNotice } from '@/components/shared/permission-notice'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { useSession } from '@/features/auth/session-context'
import { canService, useOrden } from '@/features/ordenes/api'
import { ApiSelector } from '@/features/ordenes/api-selector'
import type { ReceivedData } from '@/lib/received-data'
import type { EntregaDto, OrdenResumenDto } from '@/types/domain'
import { EntregaForm } from './entrega-form'
import type { OrdenEntrega } from './entrega-schema'
import { formatGuatemalaDateTime } from '@/lib/format'

export function EntregaDetalle({ entrega }: { entrega: EntregaDto }) {
  return <section className="space-y-2 rounded-xl border p-4" aria-label="Entrega registrada"><h2 className="font-semibold">Entrega registrada</h2><p>Receptor: {entrega.nombreRecibe}</p><p>Documento: {entrega.documentoRecibe ?? 'No indicado'}</p><p>Responsable: {entrega.usuarioEntregaNombre}</p><p>Fecha: {formatGuatemalaDateTime(entrega.fechaEntrega)}</p><p>{entrega.observaciones}</p></section>
}

export function EntregasPage(_props: { ordenes?: readonly OrdenEntrega[]; entregas?: ReceivedData<EntregaDto> }) {
  void _props
  const { user } = useSession()
  const [selected, setSelected] = useState<OrdenResumenDto | null>(null)
  const order = useOrden(selected?.idOrden)
  if (!canService(user, 'ENTREGAR_ORDEN')) return <PermissionNotice permission="ENTREGAR_ORDEN" action="registrar entregas" />
  return <div className="space-y-5"><PageHeader title="Entregas y cierre" description="Busca una orden lista, revisa su factura y saldo y confirma quién recibe el equipo." />
    <ApiSelector<OrdenResumenDto> path="/ordenes" label="Orden para entrega" filters={{ estado: 'LISTO' }} selected={selected} onSelect={setSelected} valueOf={o => o.idOrden} labelOf={o => `${o.numeroOrden} · ${o.clienteNombre}`} />
    {selected && (order.isPending ? <LoadingState label="Revisando requisitos…" /> : order.isError ? <ErrorState description={order.error.message} onRetry={() => void order.refetch()} /> : <div className="space-y-4">
      <Link className="underline" to={`/ordenes/${selected.idOrden}`}>Ver detalle de {order.data.data.numeroOrden}</Link>
      {order.data.data.entrega ? <EntregaDetalle entrega={order.data.data.entrega} /> : <EntregaForm key={selected.idOrden} orden={order.data.data} onCancel={() => setSelected(null)} />}
    </div>)}
  </div>
}
