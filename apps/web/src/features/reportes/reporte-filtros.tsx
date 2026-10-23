import { useDraftMessage } from '@/lib/use-draft-message'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import { createReportSchema } from './reporte-schema'
import type { ReportCatalogos, ReportDefinition } from './reportes-model'

export function ReporteFiltros({ report, catalogos, onCancel }: { report: ReportDefinition; catalogos: ReportCatalogos; onCancel: () => void }) {
  const defaults = Object.fromEntries(report.filters.map(filter => [filter.key, filter.kind === 'boolean' ? '1' : '']))
  const form = useForm<Record<string, string>>({ resolver: zodResolver(createReportSchema(report, catalogos)), defaultValues: defaults })
  const [message, setMessage] = useDraftMessage(catalogos)
  const blocked = report.filters.some(filter => filter.required && filter.catalog && !catalogos[filter.catalog]?.length)
  return <form aria-label="Filtros del reporte" noValidate className="space-y-4 rounded-xl border p-4" onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Filtros válidos. No se ha ejecutado una consulta; la integración del reporte está pendiente.'), () => setMessage(''))}>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{report.filters.map(filter => {
      const props = { id: `reporte-${filter.key}`, label: filter.label, required: filter.required, error: form.formState.errors[filter.key]?.message, ...form.register(filter.key) }
      return filter.catalog || filter.kind === 'boolean'
        ? <SelectField key={filter.key} {...props} placeholder={filter.required ? 'Selecciona una opción' : 'Todos'} options={filter.catalog ? catalogos[filter.catalog] : [{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }]} />
        : <TextField key={filter.key} {...props} type={filter.kind === 'date' ? 'date' : 'text'} maxLength={filter.kind === 'serie' ? 60 : undefined} />
    })}</div>
    <p className="text-sm text-muted-foreground">Los límites de fecha son días civiles de Guatemala; Hasta no se incluye. La API deberá convertirlos a instantes UTC explícitos [Desde, HastaExclusiva). Validar no actualiza los resultados recibidos ni envía solicitudes.</p>
    <DraftActions blocked={blocked} message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
