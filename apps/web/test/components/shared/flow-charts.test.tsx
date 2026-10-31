import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AttentionPanel, BarChart, DonutChart, type ChartSegment } from '@/components/shared/charts'
import { FlowGuide } from '@/components/shared/flow-guide'
import { StatCard } from '@/components/shared/stat-card'
import { SessionContext } from '@/features/auth/session-context'
import { adminUser, renderWithSession } from '../../support/session'
import { Gauge } from 'lucide-react'

const segments: ChartSegment[] = [
  { label: 'En diagnóstico', value: 3, bar: 'bg-sky-500', stroke: 'stroke-sky-500' },
  { label: 'En reparación', value: 0, bar: 'bg-indigo-500', stroke: 'stroke-indigo-500' },
]
describe('componentes de panel', () => {
  it('FlowGuide marca el paso actual y sugiere el siguiente', () => {
    render(<SessionContext.Provider value={{ user: adminUser, pending: false, verifying: false, error: null, refresh: async () => {}, signIn: async () => {}, signOut: async () => {} }}><MemoryRouter initialEntries={['/facturacion']}><FlowGuide /></MemoryRouter></SessionContext.Provider>)
    expect(screen.getByRole('link', { name: /Facturación/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText(/Siguiente paso:/)).toBeVisible()
  })
  it('gráficos exponen tabla accesible y valores', () => {
    renderWithSession(<><BarChart title="Órdenes por etapa" segments={segments} /><DonutChart title="Distribución" centerLabel="abiertas" segments={segments} /></>)
    expect(screen.getByRole('img', { name: /Órdenes por etapa: En diagnóstico 3/ })).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(2)
    expect(within(screen.getAllByRole('table')[0]).getByRole('row', { name: /En diagnóstico 3/ })).toBeInTheDocument()
  })
  it('panel de atención resalta solo cuando hay pendientes', () => {
    renderWithSession(<AttentionPanel items={[{ label: 'Facturas con saldo', value: 2, href: '/facturacion', tone: 'amber', cta: 'Revisar' }, { label: 'Repuestos bajo mínimo', value: 0, href: '/inventario', tone: 'rose', cta: 'Revisar' }]} />)
    expect(screen.getByText('Revisar')).toBeVisible()
    expect(screen.getByText('Todo en orden')).toBeVisible()
  })
  it('StatCard muestra el valor final y enlaza al módulo', () => {
    renderWithSession(<StatCard label="Órdenes abiertas" value={1234} icon={Gauge} tone="teal" href="/ordenes" />)
    expect(screen.getByText('1,234', { exact: false })).toBeVisible()
    expect(screen.getByRole('link', { name: /Ver módulo/ })).toHaveAttribute('href', '/ordenes')
  })
})

