import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, Boxes, ClipboardList, CreditCard, Eye, EyeOff, ShieldCheck, type LucideIcon } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorState, LoadingState } from '@/components/shared/states'
import { ApiError } from '@/lib/api-client'
import { useSession } from './session-context'
import { BrandMark } from '@/components/shared/brand-mark'

const loginSchema = z.object({
  nombreUsuario: z.string().trim().min(1, 'Escribe tu usuario o correo.').max(120, 'Usa hasta 120 caracteres.'),
  password: z.string().min(1, 'Escribe tu contraseña.').max(128, 'Usa hasta 128 caracteres.'),
})

const highlights: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ClipboardList, title: 'Órdenes y seguimiento', text: 'Del ingreso del equipo a la entrega.' },
  { icon: Boxes, title: 'Inventario por bodega', text: 'Existencias y movimientos al día.' },
  { icon: CreditCard, title: 'Facturación y pagos', text: 'Saldos claros antes de cada entrega.' },
]

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const { user, pending, error, refresh, signIn } = useSession()
  const location = useLocation()
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { nombreUsuario: '', password: '' } })
  const { errors, isSubmitting } = form.formState
  const from: unknown = location.state?.from
  const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\') && !Array.from(from).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) && !from.startsWith('/login') ? from : '/dashboard'
  if (pending) return <LoadingState label="Verificando tu sesión…" />
  if (user) return <Navigate to={destination} replace />

  return <main className="grid min-h-screen lg:grid-cols-2">
    <section className="bg-grid-dark relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex xl:p-16">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full bg-teal-500/15 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-36 -bottom-36 size-[36rem] rounded-full border border-teal-300/15 p-16" aria-hidden="true"><div className="size-full rounded-full border border-teal-300/15 p-16"><div className="size-full rounded-full bg-teal-700/20" /></div></div>
      <div className="relative flex items-center gap-4"><BrandMark className="h-12 w-16 text-teal-200" /><p className="text-xl font-semibold tracking-tight">Tech Care <span className="font-normal text-teal-200">Solutions</span></p></div>
      <div className="animate-enter relative max-w-lg space-y-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-teal-200 uppercase">Gestión de servicio técnico</p>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">El cuidado de cada equipo empieza con una buena gestión.</h1>
        <p className="max-w-sm text-base leading-7 text-slate-300">Servicio, inventario y administración en un mismo lugar. Todo lo que necesitas para organizar tu jornada.</p>
        <ul className="space-y-4 pt-2">{highlights.map(({ icon: Icon, title, text }) => <li key={title} className="flex items-center gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-teal-300/20 bg-teal-300/10 text-teal-200"><Icon className="size-5" aria-hidden="true" /></span><span><span className="block text-sm font-medium">{title}</span><span className="block text-sm text-slate-300">{text}</span></span></li>)}</ul>
      </div>
      <p className="relative text-xs text-slate-300">Tech Care Solutions · Atención que conecta</p>
    </section>
    <section className="flex items-center justify-center bg-muted/40 px-5 py-12 sm:px-10">
      <div className="animate-enter w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3 lg:hidden"><BrandMark className="h-10 w-12" /><p className="text-center text-2xl font-semibold tracking-tight">Tech Care <span className="font-normal text-primary">Solutions</span></p></div>
        <Card className="p-2 shadow-sm sm:p-4">
          <CardHeader className="mb-2 border-0 bg-transparent"><p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Bienvenido de nuevo</p><CardTitle className="text-3xl">Iniciar sesión</CardTitle><p className="mt-2 text-sm leading-6 text-muted-foreground">Ingresa tus credenciales para continuar con tu trabajo.</p></CardHeader>
          <CardContent>
            {error && <div className="mb-5"><ErrorState description="No pudimos comprobar tu sesión anterior." onRetry={() => void refresh()} /></div>}
            <form className="space-y-5" noValidate onChange={() => setMessage('')} onSubmit={form.handleSubmit(async input => {
              setMessage('')
              try { await signIn(input) }
              catch (error) {
                setMessage(error instanceof ApiError ? error.status === 401 ? 'Usuario o contraseña incorrectos.' : error.status === 0 ? 'No pudimos conectar. Intenta iniciar sesión nuevamente.' : error.message : 'No pudimos iniciar sesión. Intenta nuevamente.')
                if (error instanceof ApiError && error.details) {
                  for (const field of ['nombreUsuario', 'password'] as const) {
                    const detail = error.details[field]?.[0]
                    if (detail) form.setError(field, { message: detail }, { shouldFocus: true })
                  }
                }
              }
            })}>
              <div className="space-y-2">
                <Label htmlFor="username">Usuario o correo</Label>
                <Input id="username" className="h-11" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Tu usuario o correo electrónico" maxLength={120} required aria-invalid={Boolean(errors.nombreUsuario)} aria-describedby={errors.nombreUsuario ? 'username-error' : undefined} {...form.register('nombreUsuario')} />
                {errors.nombreUsuario && <p id="username-error" role="alert" className="text-xs text-destructive">{errors.nombreUsuario.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input id="password" className="h-11 pr-12" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña" maxLength={128} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} {...form.register('password')} />
                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button>
                </div>
                {errors.password && <p id="password-error" role="alert" className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              {message && <p role="alert" className="rounded-lg border border-destructive/20 bg-red-50 p-3 text-sm text-destructive">{message}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}<ArrowRight aria-hidden="true" /></Button>
            </form>
          </CardContent>
        </Card>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" />Acceso exclusivo para personal autorizado</p>
        <p className="text-center text-xs leading-6 text-muted-foreground">¿Necesitas acceso? Comunícate con administración.</p>
      </div>
    </section>
  </main>
}
