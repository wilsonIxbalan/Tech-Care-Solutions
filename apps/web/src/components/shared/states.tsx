import type { ReactNode } from 'react'
import { AlertCircle, Inbox, LoaderCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function EmptyState({ title = 'Aún no hay registros', description, action }: {
  title?: string; description: string; action?: ReactNode
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-primary/35 bg-accent/30 p-6 text-center">
      <span className="mb-3 rounded-xl border border-primary/20 bg-accent p-3"><Inbox className="size-5 text-accent-foreground" aria-hidden="true" /></span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-xs leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Consultando información…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4 rounded-lg border border-primary/25 bg-card p-5">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{label}</p>
      <Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" />
    </div>
  )
}

export function ErrorState({ title = 'No pudimos cargar la información', description, onRetry }: {
  title?: string; description: string; onRetry?: () => void
}) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 border-l-4 border-l-red-700 bg-red-50 p-5">
      <AlertCircle className="mb-3 size-5 text-red-700" aria-hidden="true" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RotateCw aria-hidden="true" />Reintentar consulta</Button>}
    </div>
  )
}
