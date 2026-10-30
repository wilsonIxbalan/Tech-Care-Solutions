import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select data-slot="native-select" className={cn('h-10 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-2 pr-9 pl-3 text-sm text-foreground shadow-xs transition-colors outline-none enabled:hover:border-primary focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive', className)} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
