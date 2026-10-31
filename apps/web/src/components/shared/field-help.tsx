import { useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'

export function FieldHelp({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false)
  return <Tooltip open={open} onOpenChange={setOpen} content={text}>
    <button
      type="button"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`Ayuda para ${label}`}
      onClick={event => {
        // Radix cierra su trigger al hacer clic. Evitar ese cierre despues del
        // foco para que raton/touch tambien puedan leer la ayuda.
        event.preventDefault()
        setOpen(true)
      }}
    >
      <CircleHelp aria-hidden="true" className="size-4" />
    </button>
  </Tooltip>
}
