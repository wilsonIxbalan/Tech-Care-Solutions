import { Link } from 'react-router-dom'
import { useSession } from '@/features/auth/session-context'
import { canService } from '@/features/ordenes/api'
import { ServiceForm } from '@/features/ordenes/service-form'
import type { OrdenDetalleDto } from '@/types/domain'
import type { DiagnosticoCatalogos } from './diagnostico-catalogos'
import { diagnosticoInputSchema } from './diagnostico-schema'

export function DiagnosticoForm({ orden, onCancel }: { orden?: OrdenDetalleDto; catalogos?: DiagnosticoCatalogos; onCancel: () => void }) {
  const { user } = useSession()
  if (!orden) return <p>Selecciona una <Link className="underline" to="/ordenes">orden de servicio</Link> para registrar su diagnóstico.</p>
  if (!canService(user, 'DIAGNOSTICO_REGISTRAR', true)) return null
  const allowed = ['RECIBIDO', 'DIAGNOSTICO'].includes(orden.estado) && !orden.diagnosticos.some(d => d.estado === 'ACTIVO')
  if (!allowed) return null
  return <ServiceForm title="Registrar diagnóstico" path={`/ordenes/${orden.idOrden}/diagnostico`} schema={diagnosticoInputSchema} onCancel={onCancel} submitLabel="Registrar diagnóstico"
    fields={[{ name: 'descripcion', label: 'Descripción del diagnóstico', kind: 'area', required: true, maxLength: 1000, placeholder: 'Falla encontrada y causa probable' }, { name: 'costoManoObraEstimado', label: 'Costo estimado de mano de obra', required: true, inputMode: 'decimal', maxLength: 13, placeholder: '0.00', help: 'Se permite cero. Hasta dos decimales, sin separadores de miles.' }]}>
    <p className="text-sm text-muted-foreground">Técnico responsable: {user?.nombreCompleto}. Registra el diagnóstico y la estimación de mano de obra antes de iniciar la reparación.</p>
  </ServiceForm>
}
