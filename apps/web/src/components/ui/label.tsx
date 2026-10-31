import type { ComponentProps } from 'react'
import { Label as LabelPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50', className)} {...props} />
}

/** Asterisco rojo decorativo; el campo ya expone `required` a lectores de pantalla. */
export function RequiredMark() {
  return <span aria-hidden="true" className="text-destructive">{' *'}</span>
}
