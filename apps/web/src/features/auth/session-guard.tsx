import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { useSession } from './session-context'
import { canAccessPath } from './route-access'
import { Button } from '@/components/ui/button'

export function SessionGuard() {
  const { user, pending, verifying, error, refresh } = useSession()
  const location = useLocation()
  if (pending) return <LoadingState label="Verificando tu sesión…" />
  if (error && !user) return <ErrorState description="No pudimos verificar tu sesión. Intenta nuevamente." onRetry={() => void refresh()} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>
    {(error || verifying) && <section role="status" aria-live="polite" className="m-4 rounded-lg border p-4">
      <p>{verifying ? 'Verificando tu sesión…' : 'No pudimos verificar tu sesión.'} Tus borradores se conservan en esta página. No puedes guardar hasta verificar la sesión.</p>
      <Button type="button" variant="outline" disabled={verifying} onClick={() => void refresh()}>Reintentar verificación</Button>
    </section>}
    <Outlet key={JSON.stringify([user.idUsuario, [...user.roles].sort(), [...user.permisos].sort()])} />
  </>
}

export function PermissionGuard() {
  const { user } = useSession()
  const { pathname } = useLocation()
  return canAccessPath(user, pathname) ? <Outlet /> : <EmptyState title="Acceso restringido" description="No tienes permiso para acceder a este módulo. Contacta a administración si necesitas acceso." />
}
