import { useState, type ComponentProps } from 'react'
import { ChevronDown, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Table({ className, containerLabel, defaultOpen = true, ...props }: ComponentProps<'table'> & { containerLabel?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const label = containerLabel ?? 'Tabla de datos'
  return <details data-slot="table-disclosure" open={open} onToggle={event => setOpen(event.currentTarget.open)} className="group/table w-full">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
      <Table2 className="size-4 text-primary" aria-hidden="true" /><span>{label}</span><ChevronDown className="ml-auto size-4 transition-transform group-open/table:rotate-180" aria-hidden="true" />
    </summary>
    <div data-slot="table-container" role={containerLabel ? 'region' : undefined} aria-label={containerLabel} tabIndex={containerLabel ? 0 : undefined} className="mt-2 w-full overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><table data-slot="table" className={cn('w-full caption-bottom bg-card text-sm', className)} {...props} /></div>
  </details>
}
export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-table-header text-white [&_tr]:border-b [&_tr]:border-table-header [&_tr:hover]:bg-transparent', className)} {...props} />
}
export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0 [&>tr:nth-child(even):not(:hover):not([data-state=selected]):not([aria-selected=true])]:bg-table-stripe', className)} {...props} />
}
export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('border-b transition-colors hover:bg-table-hover data-[state=selected]:bg-table-selected data-[state=selected]:hover:bg-table-selected aria-selected:bg-table-selected aria-selected:hover:bg-table-selected', className)} {...props} />
}
export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return <th className={cn('h-12 px-4 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-inherit', className)} {...props} />
}
export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('p-4 align-middle', className)} {...props} />
}
export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return <caption className={cn('mt-3 text-left text-xs text-muted-foreground', className)} {...props} />
}
