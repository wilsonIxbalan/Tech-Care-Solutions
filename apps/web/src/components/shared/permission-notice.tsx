import { ShieldAlert } from 'lucide-react'
import { useSession } from '@/features/auth/session-context'
import { hasPermission, roleNamesWith, type PermissionCode } from '@/features/auth/permission-roles'
import { roleLabels } from '@/features/auth/roles'

/** Aviso suave cuando el rol de la sesión no puede realizar una acción; el backend sigue autorizando. */
export function PermissionNotice({ permission, action }: { permission: PermissionCode; action: string }) {
  const { user } = useSession()
  if (!user || hasPermission(user, permission)) return null
  const own = user.roles.map(role => roleLabels[role] ?? role).join(', ')
  return <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
    <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <p>Tu rol ({own || 'sin rol asignado'}) no puede {action}. Lo pueden hacer: {roleNamesWith(permission)}.</p>
  </div>
}
