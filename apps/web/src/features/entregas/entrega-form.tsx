import { Link } from 'react-router-dom'
import { useSession } from '@/features/auth/session-context'
import { canService } from '@/features/ordenes/api'
import { ServiceForm } from '@/features/ordenes/service-form'
import { createEntregaSchema, entregaRequirements, permiteBorradorEntrega, type OrdenEntrega } from './entrega-schema'

export function EntregaForm({ orden, onCancel }: { orden?: OrdenEntrega & { entrega?: unknown }; ordenes?: readonly OrdenEntrega[]; onCancel: () => void }) {
  const { user } = useSession()
  if (!orden) return <p>Selecciona una <Link to="/ordenes" className="underline">orden</Link> para revisar los requisitos de entrega.</p>
  if (!canService(user, 'ENTREGAR_ORDEN') || orden.entrega) return null
  const schema = createEntregaSchema([orden]).omit({ idOrden: true })
  return <ServiceForm title="Confirmar entrega" path={`/ordenes/${orden.idOrden}/entrega`} schema={schema} onCancel={onCancel} blocked={!permiteBorradorEntrega(orden)} confirm submitLabel="Revisar entrega"
    body={v => ({ nombreRecibe: v.nombreRecibe, documentoRecibe: v.documentoRecibe || null, observaciones: v.observaciones || null })}
    fields={[{ name: 'nombreRecibe', label: 'Nombre de quien recibe', required: true, maxLength: 150, placeholder: 'Nombre completo', autoComplete: 'name' }, { name: 'documentoRecibe', label: 'Documento de quien recibe', maxLength: 30, inputMode: 'numeric', placeholder: 'DPI de 13 dígitos (opcional)' }, { name: 'observaciones', label: 'Observaciones de entrega', kind: 'area', maxLength: 500, placeholder: 'Observaciones de la entrega (opcional)' }]}>
    <dl className="space-y-2 rounded-lg border p-3 text-sm" aria-label="Requisitos de entrega">{entregaRequirements(orden).map(item => <div key={item.label}><dt className="font-medium">{item.label}</dt><dd>{item.status}</dd></div>)}</dl>
    <p className="text-sm text-muted-foreground">Responsable: {user?.nombreCompleto}. La fecha de entrega se registra automáticamente. La orden debe estar lista, con factura vigente y saldo cero.</p>
  </ServiceForm>
}
