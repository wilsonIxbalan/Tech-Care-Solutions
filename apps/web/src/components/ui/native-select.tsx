import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select data-slot="native-select" className={cn('h-10 w-full appearance-none rounded-md border border-input bg-card py-2 pr-9 pl-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50 aria-invalid:border-destructive', className)} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
