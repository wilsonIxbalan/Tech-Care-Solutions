import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Boxes, ClipboardList, CreditCard, Gauge, LogOut, Menu, Monitor, Package, PackageCheck, ShoppingCart, Truck, Users, UsersRound, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { BrandMark } from '@/components/shared/brand-mark'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { businessModules } from '@/app/navigation'
import { useSession } from '@/features/auth/session-context'
import { initials, roleLabels } from '@/features/auth/roles'
import { canAccessPath } from '@/features/auth/route-access'

const groups = [
  { title: 'General', links: [{ href: '/dashboard', label: 'Inicio', icon: Gauge }] },
  { title: 'Servicio técnico', links: [
    { href: '/clientes', label: 'Clientes', icon: UsersRound }, { href: '/equipos', label: 'Equipos', icon: Monitor },
    { href: '/ordenes', label: 'Órdenes de servicio', icon: ClipboardList }, { href: '/diagnosticos', label: 'Diagnósticos y reparaciones', icon: Wrench }, { href: '/entregas', label: 'Entregas y cierre', icon: PackageCheck },
  ] },
  { title: 'Abastecimiento', links: [
    { href: '/repuestos', label: 'Repuestos', icon: Package }, { href: '/inventario', label: 'Inventario y movimientos', icon: Boxes },
    { href: '/proveedores', label: 'Proveedores', icon: Truck }, { href: '/compras', label: 'Compras', icon: ShoppingCart },
  ] },
  { title: 'Administración', links: [
    { href: '/facturacion', label: 'Facturación y pagos', icon: CreditCard }, { href: '/reportes', label: 'Reportes', icon: BarChart3 }, { href: '/usuarios', label: 'Usuarios y roles', icon: Users },
  ] },
]

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useSession()
  return <div className="flex h-full flex-col overflow-y-auto">
    <Link to="/dashboard" className="rounded-lg px-6 pt-7 pb-8 outline-none focus-visible:ring-2 focus-visible:ring-teal-300" onClick={onNavigate}>
      <div className="flex items-center gap-3"><BrandMark className="h-10 w-12 text-teal-200" /><div><p className="text-xl font-semibold tracking-tight text-white">Tech Care</p><p className="mt-1 text-xs tracking-[0.18em] text-teal-200 uppercase">Solutions</p></div></div>
    </Link>
    <nav aria-label="Navegación principal" className="space-y-6 px-3 pb-6">
      {groups.map(group => ({ ...group, links: group.links.filter(link => canAccessPath(user, link.href)) })).filter(group => group.links.length > 0).map(group => <div key={group.title}><p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">{group.title}</p><div className="space-y-1">
        {group.links.map(({ href, label, icon: Icon }) => <NavLink key={href} to={href} onClick={onNavigate} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300', isActive && 'bg-teal-800/40 text-teal-100')}><Icon className="size-4 shrink-0" aria-hidden="true" />{label}</NavLink>)}
      </div></div>)}
    </nav>
    <p className="mt-auto border-t border-white/10 px-6 py-5 text-xs text-slate-400">Gestión de servicio técnico</p>
  </div>
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const { user, signOut } = useSession()
  const { hash, pathname } = useLocation()
  const currentTitle = businessModules.find(module => module.path === pathname)?.title ?? 'Inicio'
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView() }, [hash])
  return <div className="min-h-screen">
    <a href="#contenido" className="sr-only z-[100] rounded bg-card p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-sidebar lg:block"><Navigation /></aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b bg-card/95 px-5 py-3 backdrop-blur-sm sm:px-9">
        <div className="flex items-center gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú"><Menu /></Button></SheetTrigger><SheetContent><SheetTitle className="sr-only">Menú TechCare</SheetTitle><SheetDescription className="sr-only">Módulos de Tech Care Solutions.</SheetDescription><Navigation onNavigate={() => setMobileOpen(false)} /></SheetContent></Sheet>
          <p className="hidden text-sm font-medium sm:block">{currentTitle}</p>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="avatar-halo flex size-10 shrink-0 rounded-full p-0.5 ring-4 ring-primary/5"><span className="flex size-full items-center justify-center rounded-full bg-card text-sm font-semibold text-primary">{initials(user?.nombreCompleto ?? '')}</span></span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.nombreCompleto}</p><div className="mt-1 flex flex-wrap gap-1">{user?.roles.map(role => <Badge key={role} variant="outline" className="text-[10px]">{roleLabels[role]}</Badge>)}</div></div>
          <Tooltip content="Cerrar sesión"><Button variant="ghost" size="icon" aria-label="Cerrar sesión" disabled={closing} onClick={async () => { setClosing(true); setLogoutError(''); try { await signOut() } catch { setLogoutError('No pudimos cerrar la sesión. Intenta nuevamente.'); setClosing(false) } }}><LogOut aria-hidden="true" /></Button></Tooltip>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl space-y-8 px-5 py-8 outline-none sm:px-9 sm:py-10">{logoutError && <p role="alert" className="rounded-lg border border-destructive/20 p-4 text-sm text-destructive">{logoutError}</p>}<Outlet /></main>
      <footer className="border-t px-5 py-5 text-xs text-muted-foreground sm:px-9">Tech Care Solutions · Servicio técnico</footer>
    </div>
  </div>
}
