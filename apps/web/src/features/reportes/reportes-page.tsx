import { useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { SelectField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import type { ReceivedData } from '@/lib/received-data'
import { ReporteFiltros } from './reporte-filtros'
import { formatReportValue } from './reporte-format'
import { reportColumnTitle, reportDefinitions } from './reportes-model'
import type { ReportCatalogos, ReportDefinition, ReportId, ReportRow } from './reportes-model'

export type ReportResults = Partial<Record<ReportId, Readonly<Record<string, ReceivedData<ReportRow>>>>>
export function ReportesPage({ catalogos = {}, resultados = {} }: { catalogos?: ReportCatalogos; resultados?: ReportResults }) {
  const [id, setId] = useState<ReportId>('ordenes-activas')
  const selector = useRef<HTMLSelectElement>(null)
  const report: ReportDefinition = reportDefinitions.find(report => report.id === id)!
  return <><PageHeader title="Reportes" description="Acceso preparado a las doce consultas SQL. Resultados, permisos y ejecución pendientes de conectar la API." />
    <SelectField ref={selector} id="reporte-selector" label="Reporte" required options={reportDefinitions.map(report => ({ value: report.id, label: report.title }))} value={id} onChange={e => { if (reportDefinitions.some(report => report.id === e.target.value)) setId(e.target.value as ReportId) }} />
    <section aria-label={report.title} className="space-y-4"><h2 className="text-lg font-semibold">{report.title}</h2>
      {report.note && <p className="text-sm text-muted-foreground">{report.note}</p>}
      <ReporteFiltros key={id} report={report} catalogos={catalogos} onCancel={() => selector.current?.focus()} />
      <p className="text-sm text-muted-foreground">Los siguientes conjuntos corresponden a datos recibidos para este reporte, independientemente del borrador de filtros. El símbolo — conserva valores nulos o relaciones ausentes; no equivale a cero. Un campo omitido se indica como no recibido.</p>
      {report.sets.map(set => <section key={set.key} aria-label={set.title} className="space-y-3"><h3 className="font-medium">{set.title}</h3>
        <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-primary">Columnas preparadas según SQL</summary><ul className="mt-3 grid list-inside list-disc gap-2 sm:grid-cols-2 lg:grid-cols-3">{set.columns.map(key => <li key={key}>{reportColumnTitle(key)}{set.nullable?.includes(key) ? ' (puede ser nulo)' : ''}</li>)}</ul></details>
        <ReceivedTable state={resultados[id]?.[set.key]} caption={set.title} rowKey={(_, index) => index} columns={set.columns.map(key => ({ title: reportColumnTitle(key), cell: (row: ReportRow) => formatReportValue(key, row[key]) }))} />
      </section>)}
    </section></>
}
