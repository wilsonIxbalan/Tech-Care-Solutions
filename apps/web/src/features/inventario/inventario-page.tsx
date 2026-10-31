import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { optionalCivilDate } from '@/lib/civil-date'
import type { ReceivedData } from '@/lib/received-data'
import type { InventarioDto, MovimientoDto } from '@/types/domain'
import type { CategoriaOption, RepuestoRow } from '@/features/repuestos/repuesto-model'
import { inventoryColumns, movementColumns } from './inventario-model'
import type { BodegaOption, TipoMovimientoOption } from './inventario-model'
import { listState, useSupplyAccess, useSupplyCatalogs, useSupplyList } from './api'
import { SupplyPagination, SupplySelector } from './supply-controls'
import type { SupplyOption } from './supply-controls'
import { AjusteForm, MinimoForm } from './inventario-forms'
import { sqlInteger } from './inventario-schema'
import { BodegasPanel } from '@/features/bodegas/bodegas-panel'

export interface InventarioCatalogos { bodegas?: readonly BodegaOption[]; categorias?: readonly CategoriaOption[]; repuestos?: readonly RepuestoRow[]; tipos?: readonly TipoMovimientoOption[] }
const defaults = { search: '', idBodega: '', idCategoria: '', idRepuesto: '', codigoTipoMovimiento: '', fechaDesde: '', fechaHasta: '', idUsuario: '', bajoMinimo: '' }
export function InventarioPage({ catalogos = {}, inventario, movimientos }: { catalogos?: InventarioCatalogos; inventario?: ReceivedData<InventarioDto>; movimientos?: ReceivedData<MovimientoDto> }) {
  const access = useSupplyAccess()
  const catalog = useSupplyCatalogs(access.stockRead && (!catalogos.categorias || !catalogos.tipos))
  const categorias = catalogos.categorias ?? catalog.data?.categorias ?? []
  const tipos = catalogos.tipos ?? catalog.data?.tipos ?? []
  const [draft, setDraft] = useState(defaults)
  const [filters, setFilters] = useState(defaults)
  const [selected, setSelected] = useState<{ bodega?: SupplyOption; repuesto?: SupplyOption }>({})
  const [error, setError] = useState('')
  const [stockPage, setStockPage] = useState(1)
  const [movementPage, setMovementPage] = useState(1)
  const [editor, setEditor] = useState<InventarioDto | 'ajuste' | null>(null)
  const common = { search: filters.search, idBodega: filters.idBodega, idRepuesto: filters.idRepuesto, pageSize: DEFAULT_PAGE_SIZE }
  const stock = useSupplyList<InventarioDto>('inventario', { ...common, page: stockPage, idCategoria: filters.idCategoria, bajoMinimo: filters.bajoMinimo ? filters.bajoMinimo === 'true' : undefined }, inventario === undefined)
  const movements = useSupplyList<MovimientoDto>('inventario/movimientos', { ...common, page: movementPage, codigoTipoMovimiento: filters.codigoTipoMovimiento, idUsuario: filters.idUsuario, fechaDesde: filters.fechaDesde, fechaHasta: filters.fechaHasta }, movimientos === undefined)
  if (!access.stockRead) return <EmptyState title="Acceso restringido" description="No tienes permiso para consultar inventario." />
  return <><PageHeader title="Inventario y movimientos" description="Consulta existencias, movimientos y mínimos por bodega." actions={access.inventoryWrite && <Button disabled={Boolean(editor)} onClick={() => setEditor('ajuste')}>Nuevo ajuste</Button>} />
    <BodegasPanel />
    {editor === 'ajuste' && access.inventoryWrite && <AjusteForm onCancel={() => setEditor(null)} onSaved={() => setEditor(null)} />}
    {editor && editor !== 'ajuste' && access.inventoryWrite && <MinimoForm key={`${editor.idBodega}-${editor.idRepuesto}`} row={editor} onCancel={() => setEditor(null)} onSaved={() => setEditor(null)} />}
    {catalog.isError && <ErrorState description={catalog.error.message} onRetry={() => void catalog.refetch()} />}
    {catalog.isPending && (!catalogos.categorias || !catalogos.tipos) && <LoadingState label="Consultando categorías y tipos…" />}
    <form aria-label="Filtros de inventario" className="space-y-4 rounded-xl border p-4" noValidate onSubmit={event => {
      event.preventDefault()
      if (!optionalCivilDate.safeParse(draft.fechaDesde).success || !optionalCivilDate.safeParse(draft.fechaHasta).success || (draft.fechaDesde && draft.fechaHasta && draft.fechaDesde > draft.fechaHasta)) { setError('Indica un intervalo de fechas válido.'); return }
      if (draft.idUsuario && !sqlInteger(1).safeParse(draft.idUsuario).success) { setError('Indica un identificador de usuario válido.'); return }
      setError(''); setFilters(draft); setStockPage(1); setMovementPage(1)
    }}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField id="inventario-search" label="Buscar código, repuesto o documento" type="search" maxLength={150} value={draft.search} onChange={e => setDraft({ ...draft, search: e.target.value })} />
        <SupplySelector resource="bodegas" label="Bodega" id="inventario-bodega" value={draft.idBodega} selected={selected.bodega} options={catalogos.bodegas?.map(b => ({ id: b.idBodega, nombre: b.nombre }))} onSelect={option => { setSelected({ ...selected, bodega: option }); setDraft({ ...draft, idBodega: option ? String(option.id) : '' }) }} />
        <SupplySelector resource="repuestos" label="Repuesto" id="inventario-repuesto" value={draft.idRepuesto} selected={selected.repuesto} options={catalogos.repuestos?.map(r => ({ id: r.idRepuesto, nombre: `${r.codigo} · ${r.nombre}` }))} onSelect={option => { setSelected({ ...selected, repuesto: option }); setDraft({ ...draft, idRepuesto: option ? String(option.id) : '' }) }} />
        <SelectField id="inventario-categoria" label="Categoría (existencias)" placeholder="Todas" options={categorias.map(c => ({ value: String(c.idCategoria), label: c.nombre }))} value={draft.idCategoria} onChange={e => setDraft({ ...draft, idCategoria: e.target.value })} />
        <SelectField id="inventario-stock" label="Situación de existencias" placeholder="Todas" options={[{ value: 'true', label: 'Bajo mínimo' }, { value: 'false', label: 'No bajo mínimo' }]} value={draft.bajoMinimo} onChange={e => setDraft({ ...draft, bajoMinimo: e.target.value })} />
        <SelectField id="movimiento-tipo" label="Tipo (movimientos)" placeholder="Todos" options={tipos.map(t => ({ value: t.codigo, label: t.nombre }))} value={draft.codigoTipoMovimiento} onChange={e => setDraft({ ...draft, codigoTipoMovimiento: e.target.value })} />
        <TextField id="movimiento-usuario" label="ID de usuario (movimientos)" inputMode="numeric" value={draft.idUsuario} onChange={e => setDraft({ ...draft, idUsuario: e.target.value })} />
        <TextField id="movimiento-desde" label="Desde (movimientos)" type="date" value={draft.fechaDesde} onChange={e => setDraft({ ...draft, fechaDesde: e.target.value })} />
        <TextField id="movimiento-hasta" label="Hasta inclusive (movimientos)" type="date" value={draft.fechaHasta} onChange={e => setDraft({ ...draft, fechaHasta: e.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">Las fechas corresponden a Guatemala. Los filtros se aplican al conjunto completo de resultados.</p>
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-3"><Button type="submit">Aplicar filtros</Button><Button type="button" variant="outline" onClick={() => { setDraft(defaults); setFilters(defaults); setSelected({}); setError(''); setStockPage(1); setMovementPage(1) }}>Limpiar filtros</Button></div>
    </form>
    <section aria-label="Existencias por bodega" className="space-y-3"><h2 className="text-lg font-semibold">Existencias por bodega</h2>
      <ReceivedTable state={listState(stock, inventario)} columns={[...inventoryColumns, { title: 'Acciones', cell: (row: InventarioDto) => access.inventoryWrite ? <Button variant="outline" disabled={Boolean(editor)} aria-label={`Mínimo de ${row.codigoRepuesto} en ${row.bodegaNombre}`} onClick={() => setEditor(row)}>Cambiar mínimo</Button> : 'Solo consulta' }]} rowKey={r => `${r.idBodega}-${r.idRepuesto}`} caption="Existencias por bodega" />
      {stock.isError && <Button variant="outline" onClick={() => void stock.refetch()}>Reintentar inventario</Button>}
      {!inventario && <SupplyPagination label="existencias" meta={stock.data?.meta} page={stockPage} busy={stock.isFetching} onPage={setStockPage} />}
    </section>
    <section aria-label="Movimientos" className="space-y-3"><h2 className="text-lg font-semibold">Movimientos</h2>
      <ReceivedTable state={listState(movements, movimientos)} columns={movementColumns} rowKey={r => r.idMovimiento} caption="Movimientos" />
      {movements.isError && <Button variant="outline" onClick={() => void movements.refetch()}>Reintentar movimientos</Button>}
      {!movimientos && <SupplyPagination label="movimientos" meta={movements.data?.meta} page={movementPage} busy={movements.isFetching} onPage={setMovementPage} />}
    </section>
  </>
}
