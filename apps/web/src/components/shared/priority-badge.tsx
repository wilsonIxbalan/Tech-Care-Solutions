import { ArrowDown, ArrowUp, CircleHelp, Minus, Siren } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type PriorityValue = string | { codigo?: string | null; nombre?: string | null } | null | undefined

const priorities = {
  BAJA: { label: 'Baja', icon: ArrowDown, color: 'border-slate-300 bg-slate-50 text-slate-800' },
  NORMAL: { label: 'Normal', icon: Minus, color: 'border-teal-300 bg-teal-50 text-teal-900' },
  ALTA: { label: 'Alta', icon: ArrowUp, color: 'border-amber-300 bg-amber-50 text-amber-950' },
  URGENTE: { label: 'Urgente', icon: Siren, color: 'border-red-300 bg-red-50 text-red-900' },
} as const

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[\s-]+/g, '_')
}

export function PriorityBadge({ priority }: { priority: PriorityValue }) {
  const values = typeof priority === 'string' ? [priority] : [priority?.codigo, priority?.nombre]
  const key = values.map(value => value && normalize(value)).find(value => value && value in priorities) as keyof typeof priorities | undefined
  const fallback = (typeof priority === 'string' ? priority : priority?.nombre ?? priority?.codigo)?.trim() || 'Desconocida'
  const config = key ? priorities[key] : { label: fallback, icon: CircleHelp, color: 'border-slate-300 bg-slate-50 text-slate-800' }
  const Icon = config.icon
  return <Badge className={config.color}><Icon aria-hidden="true" />{config.label}</Badge>
}
