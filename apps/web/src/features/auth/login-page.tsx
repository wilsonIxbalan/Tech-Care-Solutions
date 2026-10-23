import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-3xl font-semibold tracking-tight">
            TechCare<span className="text-primary">.</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Servicio técnico, inventario y facturación
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ingresa con el usuario asignado por el administrador.
            </p>
          </CardHeader>

          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage(
                  'La conexión de inicio de sesión todavía está pendiente. No se ha iniciado ninguna sesión.',
                )
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Tu nombre de usuario"
                  pattern=".*\S.*"
                  title="Escribe un usuario que no contenga únicamente espacios."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>

                <div className="flex gap-2">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    required
                  />

                  <Button
                    type="button"
                    variant="outline"
                    aria-label={
                      showPassword
                        ? 'Ocultar contraseña'
                        : 'Mostrar contraseña'
                    }
                    aria-controls="password"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
              </div>

              {message && (
                <p
                  role="status"
                  className="rounded-lg border bg-muted p-3 text-sm"
                >
                  {message}
                </p>
              )}

              <Button type="submit" className="w-full">
                Iniciar sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}