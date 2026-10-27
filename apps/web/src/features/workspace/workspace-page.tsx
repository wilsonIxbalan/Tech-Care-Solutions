import { useQuery } from '@tanstack/react-query'
import { Boxes, ClipboardList, CreditCard, PackageCheck, Search, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/features/auth/session-context'
import { roleLabels } from '@/features/auth/roles'
import { apiFetch } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import type { DashboardDto } from '@/types/domain'

const indicators = [
  { key: 'ordenesAbiertas', label: 'Órdenes abiertas', icon: ClipboardList },
  { key: 'ordenesEnDiagnostico', label: 'En diagnóstico', icon: Search },
  { key: 'ordenesEnReparacion', label: 'En reparación', icon: Wrench },
  { key: 'ordenesListas', label: 'Listas para entregar', icon: PackageCheck },
  { key: 'facturasConSaldo', label: 'Facturas con saldo', icon: CreditCard },
  { key: 'repuestosBajoMinimo', label: 'Repuestos bajo mínimo', icon: Boxes },
] as const

export function WorkspacePage() {
  const { user } = useSession()
  const allowed = user?.permisos.includes('REPORTES_VER') ?? false
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: async ({ signal }) => (await apiFetch<DashboardDto>('/dashboard', { signal })).data, enabled: allowed })
  return <>
    <PageHeader eyebrow="Panel de trabajo" title={`Bienvenido, ${user?.nombreCompleto.split(' ')[0] ?? ''}`} description={`Tu espacio de gestión · ${user?.roles.map(role => roleLabels[role]).join(' · ') ?? ''}`} />
    {!allowed ? <EmptyState title="Tu jornada comienza aquí" description="Selecciona un módulo del menú para continuar. Los indicadores requieren permiso de consulta de reportes." /> : dashboard.isPending ? <LoadingState label="Consultando el resumen de tu operación…" /> : dashboard.isError ? <ErrorState description={dashboard.error.message} onRetry={() => void dashboard.refetch()} /> : <>
      <section aria-label="Indicadores de operación" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{indicators.map(({ key, label, icon: Icon }) => <Card key={key}><CardContent className="flex items-center justify-between gap-4 pt-6"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{dashboard.data[key].toLocaleString('es-GT')}</p></div><span className="rounded-xl bg-accent p-3 text-primary"><Icon className="size-5" aria-hidden="true" /></span></CardContent></Card>)}</section>
      <Card><CardHeader><CardTitle>Actividad reciente</CardTitle><p className="text-sm text-muted-foreground">Últimos movimientos de la operación · Hora de Guatemala</p></CardHeader><CardContent>{dashboard.data.actividadReciente.length ? <ol className="divide-y">{dashboard.data.actividadReciente.map((activity, index) => <li key={`${activity.fecha}-${index}`} className="flex gap-4 py-4"><span className="mt-1 rounded-lg bg-muted p-2" aria-hidden="true">{activity.tipo === 'ESTADO_ORDEN' ? <ClipboardList className="size-4" /> : <Boxes className="size-4" />}</span><div><p className="text-sm leading-6">{activity.descripcion}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(activity.fecha)}</p></div></li>)}</ol> : <EmptyState title="Sin actividad reciente" description="Los próximos movimientos aparecerán aquí." />}</CardContent></Card>
    </>}
  </>
}
