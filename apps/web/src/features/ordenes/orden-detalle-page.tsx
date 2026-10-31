import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { ReceivedTable } from '@/components/shared/received-table'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { DiagnosticoForm } from '@/features/diagnosticos/diagnostico-form'
import { ReparacionesSection } from '@/features/reparaciones/reparaciones-section'
import { EntregaForm } from '@/features/entregas/entrega-form'
import { EntregaDetalle } from '@/features/entregas/entregas-page'
import { FacturaDetalle } from '@/features/facturacion/factura-detalle'
import { formatMoney, formatGuatemalaDateTime } from '@/lib/format'
import { useOrden } from './api'
import { ServiceForm } from './service-form'

export function OrdenDetallePage() {
  const { id } = useParams()
  const validId = Boolean(id && /^[1-9]\d*$/.test(id) && Number(id) <= 2147483647)
  const order = useOrden(validId ? Number(id) : undefined)
  const { user } = useSession()
  const [showDiagnosis, setShowDiagnosis] = useState(true)
  const [showDelivery, setShowDelivery] = useState(true)
  if (!validId) return <EmptyState title="Orden no válida" description="Revisa el identificador de la orden." />
  if (order.isPending) return <LoadingState label="Consultando detalle de orden…" />
  if (order.isError) return <ErrorState description={order.error.message} onRetry={() => void order.refetch()} />
  const o = order.data.data
  const transitions = o.estado === 'RECIBIDO' && user?.roles.some(role => ['RECEPCION', 'TECNICO', 'ADMINISTRADOR'].includes(role)) ? ['DIAGNOSTICO']
    : o.estado === 'LISTO' && !o.factura && user?.roles.some(role => ['TECNICO', 'ADMINISTRADOR'].includes(role)) ? ['REPARACION'] : []
  if (['RECIBIDO', 'DIAGNOSTICO', 'ESPERANDO_AUTORIZACION', 'REPARACION'].includes(o.estado) && !o.factura && user?.roles.some(role => ['RECEPCION', 'ADMINISTRADOR'].includes(role))) transitions.push('CANCELADO')
  return <div className="space-y-6">
    <PageHeader title={o.numeroOrden} description={`${o.clienteNombre} · ${o.numeroSerie} · ${o.estado}`} actions={<Button asChild variant="outline"><Link to="/ordenes">Volver a órdenes</Link></Button>} />
    <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" aria-label="Datos de orden"><p>Estado: {o.estado}</p><div className="flex items-center gap-2">Prioridad: <PriorityBadge priority={o.prioridad} /></div><p>Ingreso: {formatGuatemalaDateTime(o.fechaIngreso)}</p><p>Fecha estimada: {o.fechaEstimada ?? 'Sin fecha estimada'}</p><p className="sm:col-span-2">Problema reportado: {o.problemaReportado}</p><p className="sm:col-span-2">Observaciones: {o.observaciones ?? 'Sin observaciones'}</p></section>
    {transitions.length > 0 && <ServiceForm title="Cambiar estado de orden" key={o.estado} path={`/ordenes/${o.idOrden}/estado`} schema={z.object({ estado: z.enum(transitions as [string, ...string[]]), observacion: z.string().trim().min(1, 'Indica el motivo del cambio.').max(500) })} confirm submitLabel="Revisar cambio" fields={[{ name: 'estado', label: 'Nuevo estado', kind: 'select', required: true, options: transitions.map(value => ({ value, label: value })) }, { name: 'observacion', label: 'Motivo del cambio', kind: 'area', required: true, maxLength: 500, placeholder: 'Explica por qué cambia el estado de la orden' }]} />}
    <ReceivedTable state={{ status: 'success', data: o.historial }} caption="Historial de estados" rowKey={h => h.idHistorial} columns={[
      { title: 'Anterior', cell: h => h.estadoAnterior }, { title: 'Nuevo', cell: h => h.estadoNuevo }, { title: 'Fecha', cell: h => formatGuatemalaDateTime(h.fechaCambio) }, { title: 'Usuario', cell: h => h.usuarioNombre }, { title: 'Observación', cell: h => h.observacion },
    ]} />
    <section className="space-y-4" aria-label="Diagnósticos"><h2 className="text-xl font-semibold">Diagnósticos</h2>
      <ReceivedTable state={{ status: 'success', data: o.diagnosticos }} caption="Diagnósticos registrados" rowKey={d => d.idDiagnostico} columns={[
        { title: 'Descripción', cell: d => d.descripcion }, { title: 'Técnico', cell: d => d.tecnicoNombre }, { title: 'Costo estimado (Q)', cell: d => formatMoney(d.costoManoObraEstimado) }, { title: 'Estado', cell: d => d.estado }, { title: 'Fecha', cell: d => formatGuatemalaDateTime(d.fechaDiagnostico) },
      ]} />
      {showDiagnosis ? <DiagnosticoForm orden={o} onCancel={() => setShowDiagnosis(false)} /> : <Button variant="outline" onClick={() => setShowDiagnosis(true)}>Ver registro de diagnóstico</Button>}
    </section>
    <ReparacionesSection orden={o} />
    <section className="space-y-3" aria-label="Facturación"><h2 className="text-xl font-semibold">Factura</h2>{o.factura ? <FacturaDetalle factura={o.factura} /> : <p>Sin factura registrada.</p>}
      {user?.permisos.some(p => ['FACTURAR', 'PAGOS_REGISTRAR'].includes(p)) && <Link to="/facturacion" className="underline">Ir a facturación y pagos</Link>}
    </section>
    {o.entrega ? <EntregaDetalle entrega={o.entrega} /> : showDelivery ? <EntregaForm orden={o} onCancel={() => setShowDelivery(false)} /> : <Button variant="outline" onClick={() => setShowDelivery(true)}>Revisar entrega</Button>}
  </div>
}
