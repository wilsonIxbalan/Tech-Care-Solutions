import { PermissionNotice } from '@/components/shared/permission-notice'
import { PageHeader } from '@/components/shared/page-header'
import { OrdenList } from '@/features/ordenes/ordenes-page'
import type { DiagnosticoCatalogos } from './diagnostico-catalogos'
import type { ReparacionCatalogos } from '@/features/reparaciones/reparacion-catalogos'

export function DiagnosticosPage(_props: { catalogos?: DiagnosticoCatalogos; reparacionCatalogos?: ReparacionCatalogos }) {
  void _props
  return <div className="space-y-5"><PageHeader eyebrow="TechCare / Servicio técnico" title="Diagnósticos y reparaciones" description="Abre una orden para revisar su diagnóstico, registrar trabajos, actividades y consumo de repuestos." />
    <PermissionNotice permission="DIAGNOSTICO_REGISTRAR" action="registrar diagnósticos" />
    <PermissionNotice permission="REPARACION_GESTIONAR" action="gestionar reparaciones" />
    <OrdenList initialState="DIAGNOSTICO" title="Órdenes de servicio técnico" />
  </div>
}
