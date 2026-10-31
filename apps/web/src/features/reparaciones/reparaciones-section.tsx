import { PermissionNotice } from '@/components/shared/permission-notice'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/features/auth/session-context'
import { canService } from '@/features/ordenes/api'
import { ServiceForm } from '@/features/ordenes/service-form'
import { ReceivedTable } from '@/components/shared/received-table'
import { Button } from '@/components/ui/button'
import { formatMoney, formatGuatemalaDateTime } from '@/lib/format'
import type { OrdenDetalleDto, ReparacionDto } from '@/types/domain'
import type { ReparacionCatalogos } from './reparacion-catalogos'
import { ReparacionForm } from './reparacion-form'
import { actividadInputSchema, finalizarInputSchema } from './reparacion-schema'
import { ConsumoForm } from './consumo-form'

function ReparacionDetalle({ reparacion: r, orden }: { reparacion: ReparacionDto; orden: OrdenDetalleDto }) {
  const { user } = useSession()
  const [action, setAction] = useState('')
  const inProgress = r.estado === 'EN_PROCESO' && orden.estado === 'REPARACION' && !orden.factura
  const canActivity = inProgress && canService(user, 'REPARACION_GESTIONAR', true)
  const canConsume = inProgress && canService(user, 'REPUESTOS_CONSUMIR')
  const canFinish = inProgress && canService(user, 'REPARACION_GESTIONAR') && (user?.roles.includes('ADMINISTRADOR') || (user?.roles.includes('TECNICO') && user.idUsuario === r.idTecnico))
  return <article className="space-y-4 rounded-xl border p-4">
    <h3 className="font-semibold">Reparación #{r.idReparacion} · {r.estado}</h3>
    <p>{r.descripcion}</p><p>Técnico: {r.tecnicoNombre} · Mano de obra: {formatMoney(r.costoManoObra)}</p>
    <p>Inicio: {formatGuatemalaDateTime(r.fechaInicio)} · Fin: {r.fechaFin ? formatGuatemalaDateTime(r.fechaFin) : 'En proceso'}</p>
    <ReceivedTable state={{ status: 'success', data: r.actividades }} caption="Actividades" rowKey={a => a.idActividad} columns={[
      { title: 'Descripción', cell: a => a.descripcion }, { title: 'Técnico', cell: a => a.tecnicoNombre }, { title: 'Horas', cell: a => a.horasInvertidas }, { title: 'Fecha', cell: a => formatGuatemalaDateTime(a.fechaActividad) },
    ]} />
    <ReceivedTable state={{ status: 'success', data: r.repuestos }} caption="Repuestos consumidos" rowKey={c => c.idRepuestoReparacion} columns={[
      { title: 'Repuesto', cell: c => `${c.codigoRepuesto} · ${c.repuestoNombre}` }, { title: 'Bodega', cell: c => c.bodegaNombre }, { title: 'Cantidad', cell: c => c.cantidad }, { title: 'Precio histórico (Q)', cell: c => formatMoney(c.precioVentaUnitario) }, { title: 'Subtotal (Q)', cell: c => formatMoney(c.subtotal) }, { title: 'Estado', cell: c => c.estado },
    ]} />
    {inProgress && <PermissionNotice permission="REPUESTOS_CONSUMIR" action="consumir repuestos en reparaciones" />}
    {!action && <div className="flex flex-wrap gap-2">{canActivity && <Button variant="outline" onClick={() => setAction('actividad')}>Registrar actividad</Button>}{canConsume && <Button variant="outline" onClick={() => setAction('consumo')}>Consumir repuesto</Button>}{canFinish && <Button onClick={() => setAction('finalizar')}>Finalizar reparación</Button>}</div>}
    {action === 'actividad' && canActivity && <ServiceForm title="Registrar actividad" path={`/reparaciones/${r.idReparacion}/actividades`} schema={actividadInputSchema} onCancel={() => setAction('')} fields={[{ name: 'descripcion', label: 'Descripción de la actividad', kind: 'area', required: true, maxLength: 500, placeholder: 'Trabajo realizado en esta actividad' }, { name: 'horasInvertidas', label: 'Horas invertidas', inputMode: 'decimal', maxLength: 6, placeholder: '1.50', required: true, help: 'Más de cero y hasta 999.99 horas. Hasta dos decimales.' }]} />}
    {action === 'consumo' && canConsume && <ConsumoForm idReparacion={r.idReparacion} onCancel={() => setAction('')} />}
    {action === 'finalizar' && canFinish && <ServiceForm title="Finalizar reparación" path={`/reparaciones/${r.idReparacion}/finalizar`} schema={finalizarInputSchema} onCancel={() => setAction('')} confirm submitLabel="Revisar finalización" body={v => ({ observacion: v.observacion || null })} fields={[{ name: 'observacion', label: 'Observación de finalización', kind: 'area', maxLength: 500, placeholder: 'Resultado final de la reparación (opcional)' }]}>
      <p>La orden quedará lista cuando todas sus reparaciones estén finalizadas.</p>
    </ServiceForm>}
  </article>
}

export function ReparacionesSection({ orden }: { orden?: OrdenDetalleDto; catalogos?: ReparacionCatalogos }) {
  const [showForm, setShowForm] = useState(true)
  if (!orden) return <p>Consulta las reparaciones desde el <Link to="/ordenes" className="underline">detalle de una orden</Link>.</p>
  return <section aria-label="Reparaciones" className="space-y-4"><h2 className="text-xl font-semibold">Reparaciones</h2>
    {showForm && <ReparacionForm orden={orden} onCancel={() => setShowForm(false)} />}
    {!showForm && <Button variant="outline" onClick={() => setShowForm(true)}>Ver inicio de reparación</Button>}
    {!orden.reparaciones.length && <p>La orden no tiene reparaciones registradas.</p>}
    {orden.reparaciones.map(r => <ReparacionDetalle key={r.idReparacion} reparacion={r} orden={orden} />)}
  </section>
}
