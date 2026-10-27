import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { useSession } from './session-context'
import { canAccessPath } from './route-access'

export function SessionGuard() {
  const { user, pending, error, refresh } = useSession()
  const location = useLocation()
  if (pending) return <LoadingState label="Verificando tu sesión…" />
  if (error) return <ErrorState description="No pudimos verificar tu sesión. Intenta nuevamente." onRetry={() => void refresh()} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export function PermissionGuard() {
  const { user } = useSession()
  const { pathname } = useLocation()
  return canAccessPath(user, pathname) ? <Outlet /> : <EmptyState title="Acceso restringido" description="No tienes permiso para acceder a este módulo. Contacta a administración si necesitas acceso." />
}
