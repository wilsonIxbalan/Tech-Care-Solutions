import type { ReactElement, ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

export function Tooltip({ children, content, open, onOpenChange }: {
  children: ReactElement; content: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void
}) {
  return <TooltipPrimitive.Provider delayDuration={300}>
    <TooltipPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={6} className="z-50 max-w-64 rounded-lg border bg-card px-3 py-2 text-xs leading-5 text-foreground shadow-md">
          {content}
          <TooltipPrimitive.Arrow className="fill-card" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
}
