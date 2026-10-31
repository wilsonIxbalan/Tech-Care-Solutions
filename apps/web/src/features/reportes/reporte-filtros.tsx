import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { createReportSchema } from './reporte-schema'
import type { ReportCatalogos, ReportDefinition } from './reportes-model'
import { isRemoteReportCatalog } from './reporte-lookups'
import { ReporteSelectorRemoto } from './reporte-selector-remoto'

export function ReporteFiltros({ report, catalogos, onCancel, onConsult, onEdit, remote = false, userId = 0 }: {
  report: ReportDefinition; catalogos: ReportCatalogos; onCancel: () => void
  onConsult: (values: Record<string, string>) => void; onEdit: () => void
  remote?: boolean; userId?: number
}) {
  const defaults = Object.fromEntries(report.filters.map(filter => [filter.key, filter.kind === 'boolean' ? '1' : '']))
  const form = useForm<Record<string, string>>({ resolver: zodResolver(createReportSchema(report, catalogos)), defaultValues: defaults })
  return <form aria-label="Filtros del reporte" noValidate className="space-y-4 rounded-xl border p-4" onChange={onEdit} onSubmit={form.handleSubmit(onConsult)}>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{report.filters.map(filter => {
      if (remote && isRemoteReportCatalog(filter.catalog)) {
        const catalog = filter.catalog
        return <Controller key={filter.key} control={form.control} name={filter.key} render={({ field, fieldState }) => <ReporteSelectorRemoto id={`reporte-${filter.key}`} label={filter.label} catalog={catalog} userId={userId} value={field.value} inputRef={field.ref} required={filter.required} error={fieldState.error?.message} onSelect={option => { field.onChange(option?.value ?? ''); onEdit() }} />} />
      }
      const props = { id: `reporte-${filter.key}`, label: filter.label, required: filter.required || filter.kind === 'boolean', error: form.formState.errors[filter.key]?.message, ...form.register(filter.key) }
      const options = filter.catalog ? catalogos[filter.catalog] : undefined
      return options || filter.kind === 'boolean'
        ? <SelectField key={filter.key} {...props} placeholder={filter.kind === 'boolean' ? 'Selecciona Sí o No' : filter.required ? 'Selecciona una opción' : 'Todos'} options={options ?? [{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }]} />
        : <TextField key={filter.key} {...props} type={filter.kind === 'date' ? 'date' : 'text'} inputMode={filter.key.startsWith('Id') ? 'numeric' : undefined} help={filter.key.startsWith('Id') ? 'Identificador del registro. Vacío incluye todos, salvo filtros obligatorios.' : undefined} maxLength={filter.kind === 'serie' ? 60 : filter.kind === 'date' ? undefined : 30} />
    })}</div>
    <p className="text-sm text-muted-foreground">Las fechas son días de Guatemala e incluyen ambos extremos. Consultar aplica los filtros; editar no ejecuta solicitudes.</p>
    <div className="flex flex-wrap gap-2"><Button type="submit">Consultar reporte</Button><Button variant="outline" onClick={() => { form.reset(); onEdit(); onCancel() }}>Cancelar</Button></div>
  </form>
}
