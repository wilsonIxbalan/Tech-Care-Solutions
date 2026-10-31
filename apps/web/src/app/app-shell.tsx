import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Boxes, ClipboardList, CreditCard, Gauge, LogOut, Menu, Monitor, Package, PackageCheck, PanelLeftClose, PanelLeftOpen, ShoppingCart, Truck, Users, UsersRound, Wrench } from 'lucide-react'
import { FlowGuide } from '@/components/shared/flow-guide'
import { RoleBadge } from '@/components/shared/role-badge'
import { Tooltip } from '@/components/ui/tooltip'
import { BrandMark } from '@/components/shared/brand-mark'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { businessModules } from '@/app/navigation'
import { useSession } from '@/features/auth/session-context'
import { initials } from '@/features/auth/roles'
import { canAccessPath } from '@/features/auth/route-access'

const groups = [
  { title: 'General', accent: { title: 'text-slate-400', bar: 'bg-slate-300' }, links: [{ href: '/dashboard', label: 'Inicio', icon: Gauge }] },
  { title: '1 · Recepción', accent: { title: 'text-teal-300', bar: 'bg-teal-300' }, links: [
    { href: '/clientes', label: 'Clientes', icon: UsersRound }, { href: '/equipos', label: 'Equipos', icon: Monitor }, { href: '/ordenes', label: 'Órdenes de servicio', icon: ClipboardList },
  ] },
  { title: '2 · Taller', accent: { title: 'text-sky-300', bar: 'bg-sky-300' }, links: [{ href: '/diagnosticos', label: 'Diagnósticos y reparaciones', icon: Wrench }] },
  { title: '3 · Caja y entrega', accent: { title: 'text-amber-300', bar: 'bg-amber-300' }, links: [
    { href: '/facturacion', label: 'Facturación y pagos', icon: CreditCard }, { href: '/entregas', label: 'Entregas y cierre', icon: PackageCheck },
  ] },
  { title: 'Abastecimiento', accent: { title: 'text-violet-300', bar: 'bg-violet-300' }, links: [
    { href: '/repuestos', label: 'Repuestos', icon: Package }, { href: '/inventario', label: 'Inventario y movimientos', icon: Boxes },
    { href: '/proveedores', label: 'Proveedores', icon: Truck }, { href: '/compras', label: 'Compras', icon: ShoppingCart },
  ] },
  { title: 'Administración', accent: { title: 'text-slate-300', bar: 'bg-slate-300' }, links: [
    { href: '/reportes', label: 'Reportes', icon: BarChart3 }, { href: '/usuarios', label: 'Usuarios y roles', icon: Users },
  ] },
]
const flowRoutes = ['/clientes', '/equipos', '/ordenes', '/diagnosticos', '/facturacion', '/entregas']
const storageKey = 'techcare.sidebar'
function readCollapsed() { try { return localStorage.getItem(storageKey) === 'collapsed' } catch { return false } }
function writeCollapsed(value: boolean) { try { localStorage.setItem(storageKey, value ? 'collapsed' : 'expanded') } catch { /* almacenamiento no disponible */ } }

function Navigation({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { user } = useSession()
  return <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto">
    <Link to="/dashboard" aria-label="Tech Care Solutions, ir al inicio" className={cn('rounded-lg pt-7 pb-8 outline-none focus-visible:ring-2 focus-visible:ring-teal-300', collapsed ? 'px-3' : 'px-6')} onClick={onNavigate}>
      <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}><BrandMark className="h-10 w-12 shrink-0 text-teal-200" />{!collapsed && <div><p className="text-xl font-semibold tracking-tight text-white">Tech Care</p><p className="mt-1 text-xs tracking-[0.18em] text-teal-200 uppercase">Solutions</p></div>}</div>
    </Link>
    <nav aria-label="Navegación principal" className="px-3 pb-6">
      {groups.map(group => ({ ...group, links: group.links.filter(link => canAccessPath(user, link.href)) })).filter(group => group.links.length > 0).map((group, index) => <div key={group.title} className={cn(index > 0 && 'mt-4 border-t border-white/10 pt-4')}>
        {collapsed ? <span className="sr-only">{group.title}</span> : <p className={cn('mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] uppercase', group.accent.title)}>{group.title}</p>}
        <div className="space-y-1">
          {group.links.map(({ href, label, icon: Icon }) => {
            const link = <NavLink key={href} to={href} onClick={onNavigate} aria-label={collapsed ? label : undefined} className={({ isActive }) => cn('relative flex items-center gap-3 rounded-lg py-2.5 text-sm text-slate-300 transition-colors outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300', collapsed ? 'justify-center px-0' : 'px-3', isActive && 'bg-white/10 text-white')}>
              {({ isActive }) => <>{isActive && <span aria-hidden="true" className={cn('absolute top-2 bottom-2 left-0 w-1 rounded-full', group.accent.bar)} />}<Icon className="size-4 shrink-0" aria-hidden="true" />{!collapsed && label}</>}
            </NavLink>
            return collapsed ? <Tooltip key={href} content={label}>{link}</Tooltip> : link
          })}
        </div>
      </div>)}
    </nav>
    {!collapsed && <p className="mt-auto border-t border-white/10 px-6 py-5 text-xs text-slate-400">Gestión de servicio técnico</p>}
  </div>
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [logoutError, setLogoutError] = useState('')
  const { user, signOut } = useSession()
  const { hash, pathname } = useLocation()
  const showFlow = flowRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))
  const toggle = () => { setCollapsed(value => { writeCollapsed(!value); return !value }) }
  const currentTitle = businessModules.find(module => module.path === pathname)?.title ?? 'Inicio'
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView() }, [hash])
  return <div className="min-h-screen">
    <a href="#contenido" className="sr-only z-[100] rounded bg-card p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>
    <aside className={cn('fixed inset-y-0 left-0 z-30 hidden bg-sidebar transition-[width] duration-200 lg:block', collapsed ? 'w-[4.5rem]' : 'w-64')}><Navigation collapsed={collapsed} /></aside>
    <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
      <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b bg-card/95 px-5 py-3 backdrop-blur-sm sm:px-9">
        <div className="flex items-center gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú"><Menu /></Button></SheetTrigger><SheetContent><SheetTitle className="sr-only">Menú TechCare</SheetTitle><SheetDescription className="sr-only">Módulos de Tech Care Solutions.</SheetDescription><Navigation onNavigate={() => setMobileOpen(false)} /></SheetContent></Sheet>
          <Tooltip content={collapsed ? 'Expandir menú' : 'Contraer menú'}><Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!collapsed} onClick={toggle}>{collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}</Button></Tooltip>
          <p className="hidden text-sm font-medium sm:block">{currentTitle}</p>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="avatar-halo flex size-10 shrink-0 rounded-full p-0.5 ring-4 ring-primary/5"><span className="flex size-full items-center justify-center rounded-full bg-card text-sm font-semibold text-primary">{initials(user?.nombreCompleto ?? '')}</span></span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.nombreCompleto}</p><RoleBadge user={user} /></div>
          <Tooltip content="Cerrar sesión"><Button variant="ghost" size="icon" aria-label="Cerrar sesión" disabled={closing} onClick={async () => { setClosing(true); setLogoutError(''); try { await signOut() } catch { setLogoutError('No pudimos cerrar la sesión. Intenta nuevamente.'); setClosing(false) } }}><LogOut aria-hidden="true" /></Button></Tooltip>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl space-y-8 px-5 py-8 outline-none sm:px-9 sm:py-10">{logoutError && <p role="alert" className="rounded-lg border border-destructive/20 p-4 text-sm text-destructive">{logoutError}</p>}{showFlow && <FlowGuide />}<div key={pathname} className="animate-enter space-y-8"><Outlet /></div></main>
      <footer className="border-t px-5 py-5 text-xs text-muted-foreground sm:px-9">Tech Care Solutions · Servicio técnico</footer>
    </div>
  </div>
}
