import { Link } from 'react-router-dom'
import { useSession } from '@/features/auth/session-context'
import { canService } from '@/features/ordenes/api'
import { ServiceForm } from '@/features/ordenes/service-form'
import type { OrdenDetalleDto } from '@/types/domain'
import type { ReparacionCatalogos } from './reparacion-catalogos'
import { reparacionInputSchema } from './reparacion-schema'

export function ReparacionForm({ orden, onCancel }: { orden?: OrdenDetalleDto; catalogos?: ReparacionCatalogos; onCancel: () => void }) {
  const { user } = useSession()
  if (!orden) return <p>Abre una <Link className="underline" to="/ordenes">orden</Link> para iniciar una reparación.</p>
  if (!canService(user, 'REPARACION_GESTIONAR', true) || !['ESPERANDO_AUTORIZACION', 'REPARACION'].includes(orden.estado) || orden.factura || !orden.diagnosticos.some(d => d.estado === 'ACTIVO')) return null
  return <ServiceForm title="Iniciar reparación" path={`/ordenes/${orden.idOrden}/reparaciones`} schema={reparacionInputSchema} onCancel={onCancel} submitLabel="Iniciar reparación" confirm
    fields={[{ name: 'descripcion', label: 'Descripción de la reparación', kind: 'area', required: true, maxLength: 1000 }, { name: 'costoManoObra', label: 'Costo de mano de obra', required: true, inputMode: 'decimal', help: 'Se permite cero. Hasta dos decimales, sin separadores de miles.' }]}>
    <p className="text-sm text-muted-foreground">Técnico responsable: {user?.nombreCompleto}. Confirma la autorización del trabajo antes de iniciarlo. La orden debe tener un diagnóstico activo y no estar facturada.</p>
  </ServiceForm>
}
