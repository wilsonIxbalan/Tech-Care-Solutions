import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChartSegment { label: string; value: number; bar: string; stroke: string }

function DataTable({ caption, segments }: { caption: string; segments: ChartSegment[] }) {
  return <table className="sr-only"><caption>{caption}</caption><thead><tr><th scope="col">Etapa</th><th scope="col">Órdenes</th></tr></thead><tbody>{segments.map(s => <tr key={s.label}><th scope="row">{s.label}</th><td>{s.value}</td></tr>)}</tbody></table>
}

export function BarChart({ title, segments }: { title: string; segments: ChartSegment[] }) {
  const max = Math.max(1, ...segments.map(s => s.value))
  return <div>
    <div role="img" aria-label={`${title}: ${segments.map(s => `${s.label} ${s.value}`).join(', ')}`} className="space-y-4">
      {segments.map(s => <div key={s.label} aria-hidden="true">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm"><span className="text-muted-foreground">{s.label}</span><span className="font-semibold tabular-nums">{s.value.toLocaleString('es-GT')}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn('animate-grow-x h-full rounded-full', s.bar)} style={{ width: `${(s.value / max) * 100}%` }} /></div>
      </div>)}
    </div>
    <DataTable caption={title} segments={segments} />
  </div>
}

export function DonutChart({ title, segments, centerLabel }: { title: string; segments: ChartSegment[]; centerLabel: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = 40, circumference = 2 * Math.PI * radius
  let offset = 0
  return <div>
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div role="img" aria-label={`${title}: total ${total}. ${segments.map(s => `${s.label} ${s.value}`).join(', ')}`} className="animate-pop relative size-40 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="12" className="stroke-muted" />
          {total > 0 && segments.map(s => {
            const length = (s.value / total) * circumference
            const circle = <circle key={s.label} cx="50" cy="50" r={radius} fill="none" strokeWidth="12" className={cn(s.stroke, 'transition-[stroke-dasharray] duration-700')} strokeDasharray={`${Math.max(0, length - (length > 2 ? 1 : 0))} ${circumference}`} strokeDashoffset={-offset} />
            offset += length
            return s.value > 0 ? circle : null
          })}
        </svg>
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-semibold tabular-nums">{total.toLocaleString('es-GT')}</span><span className="text-xs text-muted-foreground">{centerLabel}</span></div>
      </div>
      <ul className="w-full space-y-2 text-sm" aria-hidden="true">{segments.map(s => <li key={s.label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><span className={cn('size-2.5 rounded-full', s.bar)} />{s.label}</span><span className="font-medium tabular-nums">{s.value.toLocaleString('es-GT')}</span></li>)}</ul>
    </div>
    <DataTable caption={title} segments={segments} />
  </div>
}

export interface AttentionItem { label: string; value: number; href: string; tone: 'amber' | 'rose'; cta: string }
const tones = { amber: 'border-amber-200 bg-amber-50 text-amber-800', rose: 'border-rose-200 bg-rose-50 text-rose-800' }

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return <ul className="space-y-3">{items.map(item => {
    const alert = item.value > 0
    return <li key={item.label}><Link to={item.href} className={cn('flex items-center gap-3 rounded-lg border p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', alert ? tones[item.tone] : 'bg-card text-muted-foreground hover:bg-muted')}>
      {alert ? <AlertTriangle className="size-5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />}
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs">{alert ? item.cta : 'Todo en orden'}</span></span>
      <span className="text-xl font-semibold tabular-nums">{item.value.toLocaleString('es-GT')}</span>
    </Link></li>
  })}</ul>
}
