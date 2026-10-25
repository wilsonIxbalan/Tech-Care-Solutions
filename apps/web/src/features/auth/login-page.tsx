import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Escribe tu usuario.'),
  // No alterar ni imponer una política de contraseñas sin contrato de autenticación.
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

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
              La autenticación está pendiente de conectar la API. Por ahora solo puedes validar los campos.
            </p>
          </CardHeader>

          <CardContent>
            <form
              className="space-y-5"
              noValidate
              onChange={() => setMessage('')}
              onSubmit={form.handleSubmit(
                () => setMessage('Los campos son válidos. No se ha iniciado ninguna sesión: falta conectar la API.'),
                () => setMessage(''),
              )}
            >
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Tu nombre de usuario"
                  required
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  {...form.register('username')}
                />
                {errors.username && <p id="username-error" role="alert" className="text-xs text-destructive">{errors.username.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>

                <div className="flex gap-2">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...form.register('password')}
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
                {errors.password && <p id="password-error" role="alert" className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              {message && (
                <p
                  role="status"
                  className="rounded-lg border bg-muted p-3 text-sm"
                >
                  {message}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                Validar datos
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
