import { useEffect, useRef, useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/page-header'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession } from '@/features/auth/session-context'
import { formatMoney } from '@/lib/format'
import { FacturacionForm } from './facturacion-form'
import { FacturaDetalle } from './factura-detalle'
import { PagosFactura } from './pagos-factura'
import { facturasReadPermissions, useFactura, useFacturas, type FacturaFilters } from './api'
import { PermissionNotice } from '@/components/shared/permission-notice'

const initialFilters: FacturaFilters = { page: 1, pageSize: DEFAULT_PAGE_SIZE, search: '', estado: '', conSaldo: '', idCliente: '', fechaDesde: '', fechaHasta: '' }

export function FacturacionPage() {
  const { user } = useSession()
  if (!user?.permisos.some(permission => facturasReadPermissions.includes(permission))) return <EmptyState title="Acceso restringido" description="No tienes permiso para consultar facturas." />
  return <FacturacionWorkspace key={user.idUsuario} canInvoice={user.permisos.includes('FACTURAR')} canPay={user.permisos.includes('PAGOS_REGISTRAR')} />
}

function FacturacionWorkspace({ canInvoice, canPay }: { canInvoice: boolean; canPay: boolean }) {
  const [filters, setFilters] = useState(initialFilters)
  const [draft, setDraft] = useState(initialFilters)
  const [filterError, setFilterError] = useState('')
  const [idFactura, setIdFactura] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const facturas = useFacturas(filters)
  const detail = useFactura(idFactura)
  const pending = useIsMutating({ mutationKey: ['facturacion-write'] }) > 0
  const newButton = useRef<HTMLButtonElement>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => { if (!creating && restoreFocus.current) { newButton.current?.focus(); restoreFocus.current = false } }, [creating])
  function closeCreate() { restoreFocus.current = true; setCreating(false) }
  function select(id: number) { setIdFactura(id); setCreating(false); detailHeading.current?.focus() }
  function update(field: keyof FacturaFilters, value: string | number) { setDraft({ ...draft, [field]: value, page: 1 }); setFilterError('') }
  return <>
    <PageHeader eyebrow="TechCare / Caja" title="Facturación y pagos" description="Consulta facturas, emite desde órdenes listas y administra pagos." actions={canInvoice && <Button ref={newButton} disabled={creating || pending} onClick={() => setCreating(true)}>Nueva factura</Button>} />
    <><PermissionNotice permission="FACTURAR" action="emitir facturas" /><PermissionNotice permission="PAGOS_REGISTRAR" action="registrar o anular pagos" /></>
    {creating && canInvoice && <FacturacionForm onCancel={closeCreate} onSaved={select} onViewFactura={select} />}
    <section aria-label="Listado de facturas" className="space-y-4">
      <form aria-label="Filtros de facturas" className="space-y-4 rounded-xl border bg-card p-4" onSubmit={event => {
        event.preventDefault()
        if (draft.idCliente && (!/^[1-9]\d*$/.test(draft.idCliente) || Number(draft.idCliente) > 2147483647)) { setFilterError('Indica un ID de cliente válido.'); return }
        if (draft.fechaDesde && draft.fechaHasta && draft.fechaDesde > draft.fechaHasta) { setFilterError('La fecha final debe ser igual o posterior a la inicial.'); return }
        setFilterError(''); setFilters({ ...draft, page: 1 })
      }}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField id="facturas-buscar" label="Buscar facturas" type="search" placeholder="Buscar por factura, orden, cliente o NIT…" maxLength={150} value={draft.search} onChange={event => update('search', event.target.value)} />
          <SelectField id="facturas-estado" label="Estado" placeholder="Todos" options={['EMITIDA', 'PAGADA', 'ANULADA'].map(value => ({ value, label: value }))} value={draft.estado} onChange={event => update('estado', event.target.value)} />
          <SelectField id="facturas-saldo" label="Saldo" placeholder="Todas las facturas" options={[{ value: 'true', label: 'Solo con saldo pendiente' }]} value={draft.conSaldo} onChange={event => update('conSaldo', event.target.value)} />
          <TextField id="facturas-cliente" placeholder="Ej. 15" maxLength={10} autoComplete="off" label="ID de cliente" inputMode="numeric" value={draft.idCliente} onChange={event => update('idCliente', event.target.value)} />
          <TextField id="facturas-desde" label="Fecha desde" type="date" value={draft.fechaDesde} onChange={event => update('fechaDesde', event.target.value)} />
          <TextField id="facturas-hasta" label="Fecha hasta" type="date" min={draft.fechaDesde || undefined} value={draft.fechaHasta} onChange={event => update('fechaHasta', event.target.value)} />
          <SelectField id="facturas-tamano" label="Por página" allowEmpty={false} options={[5, 10, 20, 50].map(value => ({ value: String(value), label: String(value) }))} value={String(draft.pageSize)} onChange={event => update('pageSize', Number(event.target.value))} />
        </div>
        {filterError && <p role="alert" className="text-sm text-destructive">{filterError}</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => { setDraft(initialFilters); setFilters(initialFilters); setFilterError('') }}>Limpiar filtros</Button><Button type="submit">Aplicar filtros</Button></div>
      </form>
      {facturas.isPending ? <LoadingState label="Consultando facturas…" /> : facturas.isError ? <ErrorState description={facturas.error.message} onRetry={() => void facturas.refetch()} /> : <>
        {facturas.data.data.length ? <div className="rounded-xl border bg-card"><Table containerLabel="Facturas"><caption className="sr-only">Facturas</caption><TableHeader><TableRow>{['Factura', 'Orden', 'Cliente', 'Estado', 'Total', 'Pagado', 'Saldo', 'Acciones'].map(title => <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader><TableBody>{facturas.data.data.map(factura => <TableRow key={factura.idFactura} aria-selected={idFactura === factura.idFactura}>
          <TableCell className="font-medium">{factura.numeroFactura}</TableCell><TableCell>{factura.numeroOrden}</TableCell><TableCell>{factura.clienteNombre}</TableCell><TableCell><Badge variant="outline">{factura.estado}</Badge></TableCell><TableCell>{formatMoney(factura.total)}</TableCell><TableCell>{formatMoney(factura.totalPagado)}</TableCell><TableCell>{formatMoney(factura.saldo)}</TableCell><TableCell><Button size="sm" variant="outline" disabled={pending} onClick={() => select(factura.idFactura)} aria-label={`Ver factura ${factura.numeroFactura}`}>Ver detalle</Button></TableCell>
        </TableRow>)}</TableBody></Table></div> : <EmptyState title="Sin facturas para estos filtros" description="Cambia la búsqueda, las fechas o el estado de la factura." />}
        <div className="flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-muted-foreground">{facturas.data.meta?.total ?? facturas.data.data.length} facturas · Página {filters.page} de {Math.max(1, facturas.data.meta?.totalPages ?? 1)}</p><div className="flex gap-2"><Button variant="outline" disabled={filters.page <= 1 || facturas.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</Button><Button variant="outline" disabled={filters.page >= (facturas.data.meta?.totalPages ?? 1) || facturas.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Siguiente</Button></div></div>
      </>}
    </section>
    <section aria-label="Detalle de factura" className="space-y-4">
      <h2 ref={detailHeading} tabIndex={-1} className="text-lg font-semibold outline-none">Detalle de factura</h2>
      {idFactura === null ? <p className="text-sm text-muted-foreground">Selecciona una factura del listado para consultar sus conceptos, pagos y saldo.</p> : <>
        {detail.isPending && <LoadingState label="Consultando factura…" />}
        {detail.isError && <ErrorState description={detail.error.message} onRetry={() => void detail.refetch()} />}
        {detail.data && <><FacturaDetalle factura={detail.data} />{canPay && <PagosFactura key={detail.data.idFactura} factura={detail.data} fresh={detail.isSuccess && !detail.isFetching} />}</>}
      </>}
    </section>
  </>
}
