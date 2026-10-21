import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { Providers } from '@/app/providers'
import { AppShell } from '@/app/app-shell'
import { EmptyState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'

const DesignSystemPage = lazy(() => import('@/features/design-system/design-system-page').then((module) => ({ default: module.DesignSystemPage })))

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Suspense fallback={<LoadingState label="Preparando el kit visual…" />}><DesignSystemPage /></Suspense>} />
            <Route path="kit" element={<Navigate to="/" replace />} />
            <Route path="*" element={<EmptyState title="Esta pantalla aún no existe" description="Cristian construirá las rutas de negocio a partir de esta base. Por ahora puedes consultar el kit visual." action={<Button asChild><Link to="/">Volver al kit</Link></Button>} />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  )
}
