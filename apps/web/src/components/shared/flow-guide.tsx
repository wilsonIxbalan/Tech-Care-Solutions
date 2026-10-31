import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { businessModules } from '@/app/navigation'
import { useSession } from '@/features/auth/session-context'
import { canAccessPath } from '@/features/auth/route-access'

const steps = [
  { label: 'Recepción', href: '/clientes', paths: ['/clientes', '/equipos', '/ordenes'], hint: 'Registra al cliente, su equipo y la orden de servicio.', next: '/ordenes' },
  { label: 'Diagnóstico', href: '/diagnosticos', paths: [], hint: 'El técnico evalúa el equipo y propone la solución.', next: '/diagnosticos' },
  { label: 'Reparación', href: '/diagnosticos', paths: ['/diagnosticos'], hint: 'Se registra el trabajo realizado y los repuestos usados.', next: '/diagnosticos' },
  { label: 'Facturación', href: '/facturacion', paths: ['/facturacion'], hint: 'Se emite la factura y se registran los pagos.', next: '/facturacion' },
  { label: 'Entrega', href: '/entregas', paths: ['/entregas'], hint: 'Se entrega el equipo y se cierra la orden.', next: '/entregas' },
] as const

function currentIndex(pathname: string) {
  const index = steps.findIndex(step => step.paths.some(path => pathname === path || pathname.startsWith(`${path}/`)))
  return index
}

export function FlowGuide({ variant = 'compact', className }: { variant?: 'compact' | 'large'; className?: string }) {
  const { pathname } = useLocation()
  const { user } = useSession()
  const current = variant === 'large' ? -1 : currentIndex(pathname)
  const nextStep = steps[current + 1]
  const hint = nextStep ? businessModules.find(module => module.path === nextStep.next)?.workflow : undefined
  const large = variant === 'large'
  return <div className={className}>
    <nav aria-label="Flujo de servicio" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className={cn('flex min-w-max items-stretch gap-1', large && 'gap-2 sm:min-w-0')}>
        {steps.map((step, index) => {
          const done = current > index, active = current === index
          const body = <>
            <span className={cn('flex shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', large ? 'size-8 text-sm' : 'size-5', active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-teal-200 bg-teal-50 text-teal-700' : 'bg-card text-muted-foreground')}>{done ? <Check className={large ? 'size-4' : 'size-3'} aria-hidden="true" /> : index + 1}</span>
            <span className="min-w-0"><span className={cn('block text-xs font-medium whitespace-nowrap', large && 'text-sm', active ? 'text-primary' : done ? 'text-muted-foreground' : 'text-foreground')}>{step.label}</span>{large && <span className="mt-1 block max-w-44 text-xs leading-5 whitespace-normal text-muted-foreground">{step.hint}</span>}</span>
          </>
          const cls = cn('flex items-start gap-2 rounded-lg border border-transparent px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring', large && 'h-full p-3', active && 'border-primary/25 bg-accent', !active && canAccessPath(user, step.href) && 'transition-colors hover:bg-muted')
          return <Fragment key={step.label}>
            {index > 0 && <li aria-hidden="true" className="flex items-center text-muted-foreground/50"><ChevronRight className="size-3.5" /></li>}
            <li className={large ? 'flex-1' : undefined}>{canAccessPath(user, step.href) ? <Link to={step.href} aria-current={active ? 'step' : undefined} className={cls}>{body}</Link> : <span aria-current={active ? 'step' : undefined} className={cls}>{body}</span>}</li>
          </Fragment>
        })}
      </ol>
    </nav>
    {!large && hint && current >= 0 && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Siguiente paso:</span> {hint}</p>}
  </div>
}
