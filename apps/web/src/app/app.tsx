import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Providers } from '@/app/providers'
import { AppShell } from '@/app/app-shell'
import { businessModules } from '@/app/navigation'
import { WorkspacePage } from '@/features/workspace/workspace-page'
import { ModulePage } from '@/features/workspace/module-page'
import { EmptyState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'

const LoginPage = lazy(() =>
  import('@/features/auth/login-page').then((module) => ({
    default: module.LoginPage,
  })),
)

const DesignSystemPage = lazy(() =>
  import('@/features/design-system/design-system-page').then((module) => ({
    default: module.DesignSystemPage,
  })),
)

const ClientesPage = lazy(() =>
  import('@/features/clientes/clientes-page').then((module) => ({
    default: module.ClientesPage,
  })),
)

const EquiposPage = lazy(() =>
  import('@/features/equipos/equipos-page').then((module) => ({
    default: module.EquiposPage,
  })),
)

const OrdenesPage = lazy(() =>
  import('@/features/ordenes/ordenes-page').then((module) => ({
    default: module.OrdenesPage,
  })),
)

const DiagnosticosPage = lazy(() =>
  import('@/features/diagnosticos/diagnosticos-page').then((module) => ({
    default: module.DiagnosticosPage,
  })),
)

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <Suspense fallback={<LoadingState label="Preparando inicio de sesión…" />}>
                <LoginPage />
              </Suspense>
            }
          />

          <Route element={<AppShell />}>
            <Route index element={<WorkspacePage />} />

            <Route
              path="kit"
              element={
                <Suspense
                  fallback={
                    <LoadingState label="Preparando el kit visual…" />
                  }
                >
                  <DesignSystemPage />
                </Suspense>
              }
            />

            <Route
              path="clientes"
              element={
                <Suspense fallback={<LoadingState label="Preparando Clientes…" />}>
                  <ClientesPage />
                </Suspense>
              }
            />

            <Route
              path="equipos"
              element={
                <Suspense fallback={<LoadingState label="Preparando Equipos…" />}>
                  <EquiposPage />
                </Suspense>
              }
            />

            <Route
              path="ordenes"
              element={
                <Suspense fallback={<LoadingState label="Preparando Órdenes…" />}>
                  <OrdenesPage />
                </Suspense>
              }
            />

            <Route
              path="diagnosticos"
              element={
                <Suspense fallback={<LoadingState label="Preparando Diagnósticos…" />}>
                  <DiagnosticosPage />
                </Suspense>
              }
            />

            {businessModules.filter(module => !['/clientes', '/equipos', '/ordenes', '/diagnosticos'].includes(module.path)).map((module) => (
              <Route
                key={module.path}
                path={module.path}
                element={<ModulePage module={module} />}
              />
            ))}

            <Route
              path="*"
              element={
                <EmptyState
                  title="Esta pantalla no existe"
                  description="Selecciona un módulo del menú para continuar."
                  action={
                    <Button asChild>
                      <Link to="/">Volver al inicio</Link>
                    </Button>
                  }
                />
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  )
}
