import { cn } from '@/lib/utils'

/** Identidad aprobada: Continuidad, monograma T/C. */
export function BrandMark({ className }: { className?: string }) {
  return <svg viewBox="52 104 132 96" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn('shrink-0 text-primary', className)}>
    <path d="M64 116h84m-42 0v68" />
    <path d="M168 132c-26-27-60-9-60 24s34 49 60 24" />
  </svg>
}
