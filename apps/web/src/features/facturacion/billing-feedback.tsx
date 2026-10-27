import { useRef, type ReactNode } from 'react'
import { ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isUnconfirmed } from './api'

export function BillingError({ error }: { error: Error | null }) {
  if (!error) return null
  return <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
    <p>{error.message}</p>
    {error instanceof ApiError && error.details && <ul className="list-inside list-disc">{Object.entries(error.details).flatMap(([field, messages]) => messages.map((message, index) => <li key={`${field}-${index}`}>{field}: {message}</li>))}</ul>}
    {isUnconfirmed(error) && <p>El resultado no está confirmado. Consulta la factura y sus pagos antes de volver a enviar. No se repetirá la operación automáticamente.</p>}
    {error instanceof ApiError && error.requestId && <p className="text-xs text-muted-foreground">Referencia: {error.requestId}</p>}
  </div>
}

export function BillingConfirmation({ open, title, description, children, pending, error, confirmLabel, destructive, canConfirm = true, onCancel, onConfirm }: {
  open: boolean; title: string; description: string; children?: ReactNode; pending: boolean; error: Error | null
  confirmLabel: string; destructive?: boolean; canConfirm?: boolean; onCancel: () => void; onConfirm: () => Promise<void>
}) {
  const locked = useRef(false)
  async function confirm() {
    if (locked.current || pending || !canConfirm || isUnconfirmed(error)) return
    locked.current = true
    try { await onConfirm() } finally { locked.current = false }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value && !pending && !locked.current) onCancel() }}>
    <DialogContent onEscapeKeyDown={event => { if (pending) event.preventDefault() }} onPointerDownOutside={event => { if (pending) event.preventDefault() }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {children}<BillingError error={error} />
      <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Volver</Button><Button type="button" variant={destructive ? 'destructive' : 'default'} disabled={!canConfirm || pending || isUnconfirmed(error)} onClick={() => void confirm()}>{pending ? 'Confirmando…' : confirmLabel}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
