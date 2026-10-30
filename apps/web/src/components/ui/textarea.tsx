import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(
    'flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground enabled:hover:border-primary focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
    className,
  )} {...props} />
}
