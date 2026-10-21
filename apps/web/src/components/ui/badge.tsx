import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium [&_svg]:size-3', {
  variants: { variant: {
    default: 'border-primary/15 bg-accent text-accent-foreground',
    secondary: 'border-border bg-secondary text-secondary-foreground',
    destructive: 'border-red-200 bg-red-50 text-red-800',
    outline: 'border-border bg-card text-muted-foreground',
  } },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
}
