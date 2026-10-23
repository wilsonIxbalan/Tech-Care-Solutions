import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Presentación y foco; cada módulo conserva su propio formulario y esquema. */
export function DraftSection({ title, action, children }: { title: string; action: string; children: (cancel: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus()
    wasOpen.current = open
  }, [open])
  return <section className="space-y-4" aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2>
      <Button ref={trigger} hidden={open} onClick={() => setOpen(true)}>{action}</Button>
    </div>
    {open && <Card><CardHeader><CardTitle>{action}</CardTitle><p className="text-sm text-muted-foreground">Los campos con * son obligatorios. Se valida un borrador; todavía no se guarda.</p></CardHeader><CardContent>{children(() => setOpen(false))}</CardContent></Card>}
  </section>
}

export function DraftActions({ blocked = false, message, onCancel }: { blocked?: boolean; message: string; onCancel: () => void }) {
  return <>
    {blocked && <p className="rounded-lg border p-3 text-sm">La validación completa requiere datos y catálogos disponibles de la API.</p>}
    {message && !blocked && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{message}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={blocked}>Validar datos</Button><Button variant="outline" onClick={onCancel}>Cancelar</Button></div>
  </>
}
