import { PageHeader } from '@/components/shared/page-header'
import { DraftSection } from '@/components/shared/draft-section'
import { ReceivedTable } from '@/components/shared/received-table'
import type { ReceivedData } from '@/lib/received-data'
import type { EntregaDto } from '@/types/domain'
import { formatUtcDateTime } from '@/lib/format'
import { EntregaForm } from './entrega-form'
import type { OrdenEntrega } from './entrega-schema'

export function EntregasPage({ ordenes, entregas }: { ordenes?: readonly OrdenEntrega[]; entregas?: ReceivedData<EntregaDto> }) {
  return <><PageHeader title="Entregas y cierre" description="Preparación del receptor y revisión de requisitos recibidos. La entrega y el cierre reales están pendientes de integración." />
    <DraftSection title="Preparación de entrega" action="Preparar entrega">{cancel => <EntregaForm ordenes={ordenes} onCancel={cancel} />}</DraftSection>
    <ReceivedTable state={entregas} caption="Entregas" rowKey={e => e.idEntrega} columns={[
      { title: 'Orden (ID recibido)', cell: e => e.idOrden }, { title: 'Receptor', cell: e => e.nombreRecibe }, { title: 'Documento', cell: e => e.documentoRecibe }, { title: 'Responsable', cell: e => e.usuarioEntregaNombre }, { title: 'Fecha (UTC)', cell: e => formatUtcDateTime(e.fechaEntrega) }, { title: 'Observaciones', cell: e => e.observaciones },
    ]} /></>
}
