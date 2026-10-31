import { useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const statTones = {
  teal: 'bg-teal-50 text-teal-700', sky: 'bg-sky-50 text-sky-700', indigo: 'bg-indigo-50 text-indigo-700',
  emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700',
} as const

export type StatTone = keyof typeof statTones

function skipMotion() {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Cuenta de 0 al valor final; sin animación (valor final inmediato) si no hay matchMedia o se reduce el movimiento. */
function useCountUp(value: number, duration = 600) {
  const [shown, setShown] = useState(0)
  const skip = skipMotion()
  useEffect(() => {
    if (skip) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setShown(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, skip])
  return skip ? value : shown
}

export function StatCard({ label, value, icon: Icon, tone, href }: { label: string; value: number; icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>; tone: StatTone; href?: string }) {
  const shown = useCountUp(value)
  return <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"><CardContent className="pt-6">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{shown.toLocaleString('es-GT')}</p></div>
      <span className={cn('rounded-xl p-3', statTones[tone])}><Icon className="size-5" aria-hidden="true" /></span>
    </div>
    {href && <Link to={href} className="mt-4 inline-flex items-center gap-1 rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">Ver módulo<span className="sr-only"> de {label}</span><ArrowRight className="size-3" aria-hidden="true" /></Link>}
  </CardContent></Card>
}
