import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowUpRight, Blocks, BookOpen, Braces, CheckCheck, CircleDot, Menu, Palette, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const navigation = [
  { href: '#base', label: 'Base del equipo', icon: Blocks },
  { href: '#componentes', label: 'Componentes', icon: Braces },
  { href: '#formularios', label: 'Formularios', icon: Palette },
  { href: '#estados', label: 'Estados y feedback', icon: CircleDot },
  { href: '#comenzar', label: 'Patrones compartidos', icon: BookOpen },
]

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { hash } = useLocation()
  return (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-3 px-6 pt-7 pb-9" onClick={onNavigate}>
        <span className="flex size-10 items-center justify-center rounded-xl bg-teal-700 text-white"><Wrench className="size-5" aria-hidden="true" /></span>
        <div><p className="text-lg font-semibold tracking-tight text-white">TechCare<span className="text-teal-300">.</span></p><p className="mt-0.5 text-[10px] tracking-[0.16em] text-slate-400 uppercase">Solutions</p></div>
      </Link>
      <p className="mb-3 px-6 text-[10px] font-semibold tracking-[0.15em] text-slate-500 uppercase">Workspace / Kit de inicio</p>
      <nav aria-label="Navegación del kit" className="space-y-1 px-3">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link key={href} to={`/${href}`} onClick={onNavigate} aria-current={(hash || '#base') === href ? 'location' : undefined}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 transition-colors outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300', (hash || '#base') === href && 'bg-teal-800/35 text-teal-100')}>
            <Icon className="size-4" aria-hidden="true" />{label}
          </Link>
        ))}
      </nav>
      <div className="mx-5 mt-8 rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-teal-200"><CheckCheck className="size-4" aria-hidden="true" />Una misma base</div>
        <p className="text-xs leading-6 text-slate-400">Componentes consistentes. Contratos claros. La base de datos en el centro.</p>
      </div>
      <div className="mt-auto px-6 pt-10 pb-6">
        <div className="mb-3 flex -space-x-2" aria-hidden="true">
          {['WI', 'AN', 'AX', 'CR'].map((name) => <span key={name} className="flex size-8 items-center justify-center rounded-full border-2 border-sidebar bg-slate-700 text-[10px] font-medium text-white">{name}</span>)}
        </div>
        <p className="text-xs font-medium text-slate-200">Wilson · Angela · Axel · Cristian</p>
        <p className="mt-1 text-[11px] text-slate-500">Base de Datos I · Entrega 31 oct 2026</p>
      </div>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <div className="min-h-screen">
      <a href="#contenido" className="sr-only z-[100] rounded bg-card p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-sidebar lg:block"><Navigation /></aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b bg-card/95 px-5 backdrop-blur-sm sm:px-9">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú"><Menu /></Button></SheetTrigger>
              <SheetContent><SheetTitle className="sr-only">Menú TechCare</SheetTitle><SheetDescription className="sr-only">Secciones de la base visual del equipo.</SheetDescription><Navigation onNavigate={() => setMobileOpen(false)} /></SheetContent>
            </Sheet>
            <p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Proyecto académico <span className="mx-2 text-slate-300">/</span></span><span className="font-medium text-foreground">Kit de inicio</span></p>
          </div>
          <div className="flex items-center gap-3"><Badge variant="outline" className="hidden sm:inline-flex"><span className="size-1.5 rounded-full bg-teal-600" />Base visual</Badge><span className="text-xs text-muted-foreground">v0.1</span></div>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl space-y-10 px-5 py-8 outline-none sm:px-9 sm:py-10"><Outlet /></main>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-5 text-[11px] text-muted-foreground sm:px-9"><span>TechCare Solutions · Base compartida de diseño</span><span className="flex items-center gap-1">Los procesos reales se integran con NestJS y SQL <ArrowUpRight className="size-3" aria-hidden="true" /></span></footer>
      </div>
    </div>
  )
}
