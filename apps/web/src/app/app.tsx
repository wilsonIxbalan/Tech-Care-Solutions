import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Providers } from '@/app/providers'
import { AppShell } from '@/app/app-shell'
import { businessModules } from '@/app/navigation'
import { WorkspacePage } from '@/features/workspace/workspace-page'
import { ModulePage } from '@/features/workspace/module-page'
import { EmptyState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'

const DesignSystemPage = lazy(() => import('@/features/design-system/design-system-page').then((module) => ({ default: module.DesignSystemPage })))

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<WorkspacePage />} />
            <Route path="kit" element={<Suspense fallback={<LoadingState label="Preparando el kit visual…" />}><DesignSystemPage /></Suspense>} />
            {businessModules.map(module => <Route key={module.path} path={module.path} element={<ModulePage module={module} />} />)}
            <Route path="*" element={<EmptyState title="Esta pantalla no existe" description="Selecciona un módulo del menú para continuar." action={<Button asChild><Link to="/">Volver al inicio</Link></Button>} />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  )
}
