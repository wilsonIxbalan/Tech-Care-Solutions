import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/page-header'
import { SelectField } from '@/components/shared/form-fields'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { apiFetch, ApiError } from '@/lib/api-client'
import { ReporteFiltros } from './reporte-filtros'
import { reportDefinitions, reportHttpFilters } from './reportes-model'
import type { ReportCatalogos, ReportDefinition, ReportId } from './reportes-model'
import { ReporteResultados } from './reporte-resultados'
import { parseReportResponse } from './reporte-response'
import { ExportarReporte } from './exportar-reporte'
import { parseReportCatalogs, reportStateOptions } from './reporte-lookups'

const operationalNotes: Partial<Record<ReportId, string>> = {
  'historial-cliente': 'Consulta los equipos y las órdenes del cliente, incluso si aún no tiene servicios registrados.',
  'historial-equipo': 'Revisa diagnósticos, trabajos y entregas asociados al número de serie.',
  'facturas-saldo': 'Consulta las facturas con sus pagos y saldo vigente.',
  trazabilidad: 'Sigue el recorrido de la orden, desde su recepción hasta la entrega.',
}

function ReporteConsulta({ report, catalogos, userId, onCancel, remote }: { report: ReportDefinition; catalogos: ReportCatalogos; userId: number; onCancel: () => void; remote: boolean }) {
  const [applied, setApplied] = useState<Record<string, string> | null>(null)
  const [page, setPage] = useState(1)
  const filters = reportHttpFilters(report, applied ?? {}).toString()
  const query = useQuery({
    queryKey: ['reportes', userId, report.id, applied ? filters : null, page],
    enabled: applied !== null,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams(filters)
      params.set('page', String(page))
      params.set('pageSize', '20')
      return parseReportResponse(report, await apiFetch<unknown>(`/reportes/${report.id}?${params}`, { signal }))
    },
  })
  return <section aria-label={report.title} className="space-y-4">
    <h2 className="text-lg font-semibold">{report.title}</h2>
    {report.note && <p className="text-sm text-muted-foreground">{operationalNotes[report.id as ReportId] ?? report.note}</p>}
    <ReporteFiltros report={report} catalogos={catalogos} userId={userId} remote={remote} onCancel={onCancel} onEdit={() => { setApplied(null); setPage(1) }} onConsult={values => { setApplied({ ...values }); setPage(1); if (applied && reportHttpFilters(report, values).toString() === filters && page === 1) void query.refetch() }} />
    {!applied ? <EmptyState title="Consulta un reporte" description="Aplica los filtros con Consultar reporte para ver los resultados y habilitar las descargas." /> : <>
      <p className="text-sm" aria-label="Filtros aplicados"><strong>Filtros aplicados: </strong>{report.filters.filter(filter => applied[filter.key]).map(filter => `${filter.label}: ${filter.kind === 'boolean' ? applied[filter.key] === '1' ? 'Sí' : 'No' : catalogos[filter.catalog!]?.find(option => option.value === applied[filter.key])?.label ?? applied[filter.key]}`).join(' · ') || 'Todos los registros.'}</p>
      {query.isFetching ? <LoadingState label="Consultando reporte…" /> : query.isError ? <ErrorState description={query.error instanceof ApiError ? [query.error.message, query.error.details ? Object.values(query.error.details).flat().join(' ') : '', query.error.requestId ? `Referencia: ${query.error.requestId}` : ''].filter(Boolean).join(' ') : 'No se pudo consultar el reporte.'} onRetry={() => { void query.refetch() }} /> : query.data ? <>
        <ExportarReporte key={filters} report={report} filters={filters} />
        <ReporteResultados sections={query.data.sections} />
        {query.data.meta && <nav aria-label="Paginación del reporte" className="flex flex-wrap items-center gap-3">
          <span className="text-sm">Página {query.data.meta.page} de {Math.max(1, query.data.meta.totalPages)} · {query.data.meta.total} registros</span>
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button variant="outline" disabled={page >= query.data.meta.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </nav>}
      </> : null}
    </>}
  </section>
}

export function ReportesPage({ catalogos }: { catalogos?: ReportCatalogos }) {
  const [id, setId] = useState<ReportId>('ordenes-activas')
  const selector = useRef<HTMLSelectElement>(null)
  const { user } = useSession()
  const catalogs = useQuery({
    queryKey: ['reportes-catalogos', user?.idUsuario],
    enabled: catalogos === undefined && Boolean(user?.permisos.includes('REPORTES_VER')),
    retry: false,
    queryFn: async ({ signal }) => parseReportCatalogs((await apiFetch<unknown>('/catalogos', { signal })).data),
  })
  const financial = user?.roles.some(role => role === 'ADMINISTRADOR' || role === 'CAJA') ?? false
  const available = reportDefinitions.filter(report => financial || !['facturas-saldo', 'ingresos', 'compras-proveedor'].includes(report.id))
  const report: ReportDefinition = available.find(report => report.id === id) ?? available[0]
  if (!user?.permisos.includes('REPORTES_VER')) return <EmptyState title="Acceso restringido" description="No tienes permiso para consultar reportes." />
  return <><PageHeader title="Reportes" description="Consulta la operación del taller y descarga los resultados con los filtros aplicados." />
    <SelectField ref={selector} id="reporte-selector" label="Reporte" required options={available.map(report => ({ value: report.id, label: report.title }))} value={report.id} onChange={event => { if (available.some(report => report.id === event.target.value)) setId(event.target.value as ReportId) }} />
    {catalogos === undefined && catalogs.isPending ? <LoadingState label="Cargando opciones de reportes…" /> : catalogos === undefined && catalogs.isError ? <ErrorState description={catalogs.error.message} onRetry={() => void catalogs.refetch()} /> : <ReporteConsulta key={`${user.idUsuario}-${user.roles.join(',')}-${report.id}`} report={report} catalogos={catalogos ?? { ...reportStateOptions, ...catalogs.data }} remote={catalogos === undefined} userId={user.idUsuario} onCancel={() => selector.current?.focus()} />}
  </>
}
