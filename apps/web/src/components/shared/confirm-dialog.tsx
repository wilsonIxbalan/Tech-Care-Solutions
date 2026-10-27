import { useState, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

export function ConfirmDialog({ trigger, title, description, confirmLabel = 'Confirmar', destructive = false, onConfirm }: {
  trigger: ReactNode; title: string; description: string; confirmLabel?: string
  destructive?: boolean; onConfirm: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      setOpen(false)
    } catch (error) {
      setError(error instanceof ApiError ? error.message : 'No se confirmó el resultado. Consulta el estado antes de volver a intentar la operación.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!pending) { setError(null); setOpen(value) } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={pending}>Cancelar</Button></DialogClose>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={pending} onClick={() => void confirm()}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}{pending ? 'Confirmando…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
