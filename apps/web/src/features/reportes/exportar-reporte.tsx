import { useEffect, useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Tooltip } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/shared/form-fields'
import { downloadFile, downloadErrorMessage } from '@/lib/download-client'
import type { ReportDefinition } from './reportes-model'

export function ExportarReporte({ report, filters }: { report: ReportDefinition; filters: string }) {
  const [conjunto, setConjunto] = useState('1')
  const descriptionId = useId()
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort() }, [])
  const download = useMutation({
    retry: false,
    mutationFn: async (type: 'csv' | 'xlsx') => {
      controller.current = new AbortController()
      const params = new URLSearchParams(filters)
      params.delete('page')
      params.delete('pageSize')
      params.set('formato', type)
      if (type === 'csv') params.set('conjunto', conjunto)
      else params.delete('conjunto')
      await downloadFile(`/reportes/${report.id}/exportar?${params}`, { type, filename: `${report.id}.${type}`, signal: controller.current.signal })
    },
  })
  const hint = 'Descarga todos los resultados de los filtros aplicados, no solo esta página. Máximo 10 000 filas en total; si se supera el límite, reduce el intervalo o los filtros. CSV descarga el conjunto seleccionado; Excel incluye una hoja por conjunto.'
  return <div className="space-y-3 rounded-xl border p-4" aria-label="Exportar reporte">
    <p id={descriptionId} className="text-sm text-muted-foreground">{hint}</p>
    <SelectField id="reporte-conjunto" label="Conjunto para CSV" required value={conjunto} onChange={event => { setConjunto(event.target.value); download.reset() }} options={report.sets.map((set, index) => ({ value: String(index + 1), label: `${index + 1}. ${set.title}` }))} disabled={download.isPending} />
    <Tooltip.Provider><div className="flex flex-wrap gap-2">{(['csv', 'xlsx'] as const).map(type => <Tooltip.Root key={type}><Tooltip.Trigger asChild>
      <Button variant="outline" aria-describedby={descriptionId} disabled={download.isPending || (type === 'csv' && !conjunto)} onClick={() => download.mutate(type)}>{type === 'csv' ? 'Exportar CSV' : 'Exportar Excel'}</Button>
    </Tooltip.Trigger><Tooltip.Portal><Tooltip.Content sideOffset={5} className="z-50 max-w-sm rounded-md bg-foreground p-3 text-xs text-background">{hint}<Tooltip.Arrow /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>)}</div></Tooltip.Provider>
    {download.isPending && <p role="status">Descargando reporte…</p>}
    {download.isError && <p role="alert" className="text-sm text-destructive">{downloadErrorMessage(download.error)}</p>}
  </div>
}
