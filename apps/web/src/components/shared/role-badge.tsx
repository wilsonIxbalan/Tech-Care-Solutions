import { Check, Lock, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { permissionCodes, permissionLabels, roleNamesWith } from '@/features/auth/permission-roles'
import { roleLabels } from '@/features/auth/roles'
import type { SessionUser } from '@/types/api'

export function RoleBadge({ user }: { user: SessionUser | null }) {
  if (!user) return null
  const names = user.roles.map(role => roleLabels[role]).join(' · ')
  const allowed = permissionCodes.filter(code => user.permisos.includes(code))
  const denied = permissionCodes.filter(code => !user.permisos.includes(code))
  return <Dialog>
    <DialogTrigger asChild><button type="button" aria-label={`Ver tu rol y permisos: ${names}`} className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800 outline-none transition-colors hover:bg-teal-100 focus-visible:ring-2 focus-visible:ring-ring"><ShieldCheck className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{names}</span></button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Tu rol y permisos</DialogTitle><DialogDescription>Roles asignados: {names}</DialogDescription></DialogHeader>
      <section aria-label="Puedes"><h3 className="mb-2 text-sm font-semibold">Puedes:</h3>
        <ul className="space-y-1.5">{allowed.map(code => <li key={code} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />{permissionLabels[code]}</li>)}</ul>
      </section>
      {denied.length > 0 && <section aria-label="No disponible"><h3 className="mb-2 text-sm font-semibold">No disponible para tu rol:</h3>
        <ul className="space-y-1.5">{denied.map(code => <li key={code} className="flex items-start gap-2 text-sm text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{permissionLabels[code]} <span className="text-xs">· Lo pueden hacer: {roleNamesWith(code)}</span></span></li>)}</ul>
      </section>}
    </DialogContent>
  </Dialog>
}
