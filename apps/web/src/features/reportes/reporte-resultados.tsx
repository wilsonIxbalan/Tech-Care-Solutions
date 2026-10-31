import { ReceivedTable } from '@/components/shared/received-table'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { formatReportValue } from './reporte-format'
import { reportColumnTitle, type ReportRow } from './reportes-model'
import type { ReportSection } from './reporte-response'

export function ReporteResultados({ sections }: { sections: ReportSection[] }) {
  return <div className="space-y-5">{sections.map((section, index) => <section key={`${section.title}-${index}`} aria-label={section.title} className="space-y-3 rounded-lg border p-3">
    <h3 className="font-medium">{section.title}</h3>
    {(section.rows.length > 0 || !section.children?.length) && <ReceivedTable state={{ status: 'success', data: section.rows }} caption={section.title} rowKey={(_, row) => row} columns={[...new Set(section.rows.flatMap(row => Object.keys(row)))].map(key => ({ title: reportColumnTitle(key), cell: (row: ReportRow) => key.toLowerCase() === 'prioridad' && typeof row[key] === 'string' ? <PriorityBadge priority={row[key] as string} /> : formatReportValue(key, row[key]) }))} />}
    {!!section.children?.length && <ReporteResultados sections={section.children} />}
  </section>)}</div>
}
