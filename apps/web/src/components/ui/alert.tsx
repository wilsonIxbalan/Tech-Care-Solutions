import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Alert({ className, variant = 'default', ...props }: ComponentProps<'div'> & { variant?: 'default' | 'destructive' }) {
  return <div data-slot="alert" role="alert" className={cn(
    'relative grid gap-1 rounded-lg border bg-card p-4 text-sm [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg]:size-4 [&:has(>svg)]:pl-11',
    variant === 'destructive' && 'border-red-200 bg-red-50 text-red-800', className,
  )} {...props} />
}
export function AlertTitle({ className, ...props }: ComponentProps<'h4'>) {
  return <h4 data-slot="alert-title" className={cn('font-semibold leading-5', className)} {...props} />
}
export function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('text-sm leading-6 opacity-85', className)} {...props} />
}
