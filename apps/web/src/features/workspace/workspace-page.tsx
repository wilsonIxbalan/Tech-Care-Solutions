import { useQuery } from '@tanstack/react-query'
import { Boxes, ClipboardList, CreditCard, PackageCheck, Search, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { StatCard, type StatTone } from '@/components/shared/stat-card'
import { AttentionPanel, BarChart, DonutChart, type ChartSegment } from '@/components/shared/charts'
import { FlowGuide } from '@/components/shared/flow-guide'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/features/auth/session-context'
import { roleLabels } from '@/features/auth/roles'
import { apiFetch } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardDto } from '@/types/domain'

const indicators: { key: Exclude<keyof DashboardDto, 'actividadReciente'>; label: string; icon: typeof Search; tone: StatTone; href: string }[] = [
  { key: 'ordenesAbiertas', label: 'Órdenes abiertas', icon: ClipboardList, tone: 'teal', href: '/ordenes' },
  { key: 'ordenesEnDiagnostico', label: 'En diagnóstico', icon: Search, tone: 'sky', href: '/diagnosticos' },
  { key: 'ordenesEnReparacion', label: 'En reparación', icon: Wrench, tone: 'indigo', href: '/diagnosticos' },
  { key: 'ordenesListas', label: 'Listas para entregar', icon: PackageCheck, tone: 'emerald', href: '/entregas' },
  { key: 'facturasConSaldo', label: 'Facturas con saldo', icon: CreditCard, tone: 'amber', href: '/facturacion' },
  { key: 'repuestosBajoMinimo', label: 'Repuestos bajo mínimo', icon: Boxes, tone: 'rose', href: '/inventario' },
]

function stageSegments(data: DashboardDto): ChartSegment[] {
  const otras = Math.max(0, data.ordenesAbiertas - data.ordenesEnDiagnostico - data.ordenesEnReparacion - data.ordenesListas)
  return [
    { label: 'En diagnóstico', value: data.ordenesEnDiagnostico, bar: 'bg-sky-500', stroke: 'stroke-sky-500' },
    { label: 'En reparación', value: data.ordenesEnReparacion, bar: 'bg-indigo-500', stroke: 'stroke-indigo-500' },
    { label: 'Listas para entregar', value: data.ordenesListas, bar: 'bg-emerald-500', stroke: 'stroke-emerald-500' },
    { label: 'Otras abiertas', value: otras, bar: 'bg-slate-400', stroke: 'stroke-slate-400' },
  ]
}

export function WorkspacePage() {
  const { user } = useSession()
  const allowed = user?.permisos.includes('REPORTES_VER') ?? false
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: async ({ signal }) => (await apiFetch<DashboardDto>('/dashboard', { signal })).data, enabled: allowed })
  return <>
    <PageHeader eyebrow="Panel de trabajo" title={`Bienvenido, ${user?.nombreCompleto.split(' ')[0] ?? ''}`} description={`Tu espacio de gestión · ${user?.roles.map(role => roleLabels[role]).join(' · ') ?? ''}`} />
    {!allowed ? <EmptyState title="Tu jornada comienza aquí" description="Selecciona un módulo del menú para continuar. Los indicadores requieren permiso de consulta de reportes." /> : dashboard.isPending ? <LoadingState label="Consultando el resumen de tu operación…" /> : dashboard.isError ? <ErrorState description={dashboard.error.message} onRetry={() => void dashboard.refetch()} /> : <>
      <section aria-label="Indicadores de operación" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{indicators.map(({ key, label, icon, tone, href }) => <StatCard key={key} label={label} value={dashboard.data[key]} icon={icon} tone={tone} href={href} />)}</section>
      <section aria-label="Gráficos de operación" className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Órdenes por etapa</CardTitle></CardHeader><CardContent><BarChart title="Órdenes por etapa" segments={stageSegments(dashboard.data)} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Distribución de órdenes abiertas</CardTitle></CardHeader><CardContent><DonutChart title="Distribución de órdenes abiertas" centerLabel="abiertas" segments={stageSegments(dashboard.data)} /></CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Requiere atención</CardTitle></CardHeader><CardContent><AttentionPanel items={[
          { label: 'Facturas con saldo', value: dashboard.data.facturasConSaldo, href: '/facturacion', tone: 'amber', cta: 'Revisar cobros pendientes' },
          { label: 'Repuestos bajo mínimo', value: dashboard.data.repuestosBajoMinimo, href: '/inventario', tone: 'rose', cta: 'Revisar inventario' },
        ]} /></CardContent></Card>
      </section>
      <Card><CardHeader><CardTitle>Cómo funciona</CardTitle><p className="text-sm text-muted-foreground">Del ingreso del equipo a la entrega, en cinco pasos.</p></CardHeader><CardContent><FlowGuide variant="large" /></CardContent></Card>
      <Card><CardHeader><CardTitle>Actividad reciente</CardTitle><p className="text-sm text-muted-foreground">Últimos movimientos de la operación · Hora de Guatemala</p></CardHeader><CardContent>{dashboard.data.actividadReciente.length ? <ol className="relative ml-2 space-y-5 border-l pl-6">{dashboard.data.actividadReciente.map((activity, index) => <li key={`${activity.fecha}-${index}`} className="relative"><span aria-hidden="true" className={cn('absolute top-1.5 -left-[1.9rem] size-3 rounded-full ring-4 ring-card', activity.tipo === 'ESTADO_ORDEN' ? 'bg-teal-500' : 'bg-violet-500')} /><p className="text-sm leading-6">{activity.descripcion}</p><p className="mt-0.5 text-xs text-muted-foreground">{activity.tipo === 'ESTADO_ORDEN' ? 'Orden' : 'Inventario'} · {formatDateTime(activity.fecha)}</p></li>)}</ol> : <EmptyState title="Sin actividad reciente" description="Los próximos movimientos aparecerán aquí." />}</CardContent></Card>
    </>}
  </>
}
