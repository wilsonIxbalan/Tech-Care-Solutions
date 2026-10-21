import { Badge } from '@/components/ui/badge'
import { Ban, CheckCheck, CircleCheck, CircleDot, Clock3, Search, Wrench } from 'lucide-react'
import type { OrderState } from '@/types/api'

const states = {
  RECIBIDO: { label: 'Recibido', icon: CircleDot, color: 'border-slate-200 bg-slate-50 text-slate-700' },
  DIAGNOSTICO: { label: 'En diagnóstico', icon: Search, color: 'border-blue-200 bg-blue-50 text-blue-800' },
  ESPERANDO_AUTORIZACION: { label: 'Esperando autorización', icon: Clock3, color: 'border-amber-200 bg-amber-50 text-amber-900' },
  REPARACION: { label: 'En reparación', icon: Wrench, color: 'border-violet-200 bg-violet-50 text-violet-800' },
  LISTO: { label: 'Listo para entregar', icon: CircleCheck, color: 'border-teal-200 bg-teal-50 text-teal-800' },
  ENTREGADO: { label: 'Entregado', icon: CheckCheck, color: 'border-green-200 bg-green-50 text-green-800' },
  CANCELADO: { label: 'Cancelado', icon: Ban, color: 'border-red-200 bg-red-50 text-red-800' },
} satisfies Record<OrderState, { label: string; icon: typeof CircleDot; color: string }>

export function StatusBadge({ state }: { state: OrderState }) {
  const config = states[state]
  const Icon = config.icon
  return <Badge className={config.color}><Icon aria-hidden="true" />{config.label}</Badge>
}
