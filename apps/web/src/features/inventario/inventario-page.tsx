import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/shared/page-header'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { ReceivedTable } from '@/components/shared/received-table'
import { Button } from '@/components/ui/button'
import { dateRangeSchema, guatemalaCivilDay, inCivilRange } from '@/lib/civil-date'
import { selection } from '@/lib/draft-schema'
import type { ReceivedData } from '@/lib/received-data'
import type { InventarioDto, MovimientoDto } from '@/types/domain'
import type { CategoriaOption, RepuestoRow } from '@/features/repuestos/repuesto-model'
import { inventoryColumns, movementColumns } from './inventario-model'
import type { BodegaOption, TipoMovimientoOption } from './inventario-model'

export interface InventarioCatalogos { bodegas?: readonly BodegaOption[]; categorias?: readonly CategoriaOption[]; repuestos?: readonly RepuestoRow[]; tipos?: readonly TipoMovimientoOption[] }
const defaults = { idBodega: '', idCategoria: '', idRepuesto: '', tipo: '', desde: '', hastaExclusiva: '', stock: '' as '' | 'cero' | 'minimo' }
export function InventarioPage({ catalogos = {}, inventario = { status: 'pending' }, movimientos = { status: 'pending' } }: {
  catalogos?: InventarioCatalogos; inventario?: ReceivedData<InventarioDto>; movimientos?: ReceivedData<MovimientoDto>
}) {
  const optionalSelection = (values: string[] | undefined, label: string) => z.union([z.literal(''), selection(values, label)])
  const schema = dateRangeSchema.and(z.object({
    idBodega: optionalSelection(catalogos.bodegas?.map(b => String(b.idBodega)), 'una bodega'),
    idCategoria: optionalSelection(catalogos.categorias?.map(c => String(c.idCategoria)), 'una categoría'),
    idRepuesto: optionalSelection(catalogos.repuestos?.map(r => String(r.idRepuesto)), 'un repuesto'),
    tipo: optionalSelection(catalogos.tipos?.map(t => t.codigo), 'un tipo'), stock: z.enum(['', 'cero', 'minimo']),
  }))
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: defaults })
  const [filters, setFilters] = useState(defaults)
  const { errors } = form.formState
  const stockRows = inventario.status === 'success' ? { ...inventario, data: inventario.data.filter(r =>
    (!filters.idBodega || String(r.idBodega) === filters.idBodega) && (!filters.idCategoria || String(r.idCategoria) === filters.idCategoria) && (!filters.idRepuesto || String(r.idRepuesto) === filters.idRepuesto)
    && (filters.stock !== 'cero' || r.existencia === 0) && (filters.stock !== 'minimo' || r.existencia <= r.stockMinimo)) } : inventario
  const unverifiedDates = Boolean((filters.desde || filters.hastaExclusiva) && movimientos.status === 'success' && movimientos.data.some(r => guatemalaCivilDay(r.fechaMovimiento) === null))
  const movementRows: ReceivedData<MovimientoDto> = unverifiedDates ? { status: 'error', message: 'No se puede aplicar el intervalo: hay movimientos con fecha o zona no verificable. Limpia las fechas para revisar las filas recibidas.' } : movimientos.status === 'success' ? { ...movimientos, data: movimientos.data.filter(r =>
    (!filters.idBodega || String(r.idBodega) === filters.idBodega) && (!filters.idRepuesto || String(r.idRepuesto) === filters.idRepuesto) && (!filters.tipo || r.codigoTipoMovimiento === filters.tipo) && inCivilRange(r.fechaMovimiento, filters.desde, filters.hastaExclusiva)) } : movimientos
  return <><PageHeader title="Inventario y movimientos" description="Vistas de consulta. Los movimientos y las existencias sólo cambian mediante procesos controlados del servidor." />
    <form aria-label="Filtros de inventario" className="space-y-4 rounded-xl border p-4" noValidate onSubmit={form.handleSubmit(setFilters)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField id="inventario-bodega" label="Bodega" placeholder="Todas" options={catalogos.bodegas?.map(b => ({ value: String(b.idBodega), label: b.nombre }))} error={errors.idBodega?.message} {...form.register('idBodega')} />
        <SelectField id="inventario-categoria" label="Categoría (existencias)" placeholder="Todas" options={catalogos.categorias?.map(c => ({ value: String(c.idCategoria), label: c.nombre }))} error={errors.idCategoria?.message} {...form.register('idCategoria')} />
        <SelectField id="inventario-repuesto" label="Repuesto" placeholder="Todos" options={catalogos.repuestos?.map(r => ({ value: String(r.idRepuesto), label: `${r.codigo} · ${r.nombre}` }))} error={errors.idRepuesto?.message} {...form.register('idRepuesto')} />
        <SelectField id="inventario-stock" label="Situación de existencias" placeholder="Todas" options={[{ value: 'cero', label: 'Stock cero' }, { value: 'minimo', label: 'Igual o inferior al mínimo' }]} {...form.register('stock')} />
        <SelectField id="movimiento-tipo" label="Tipo (movimientos)" placeholder="Todos" options={catalogos.tipos?.map(t => ({ value: t.codigo, label: t.nombre }))} error={errors.tipo?.message} {...form.register('tipo')} />
        <TextField id="movimiento-desde" label="Desde (movimientos)" type="date" error={errors.desde?.message} {...form.register('desde')} />
        <TextField id="movimiento-hasta" label="Hasta, exclusivo (movimientos)" type="date" error={errors.hastaExclusiva?.message} {...form.register('hastaExclusiva')} />
      </div>
      <p className="text-sm text-muted-foreground">Filtros sobre filas recibidas, sin solicitar información. Las fechas son días civiles de Guatemala; Hasta no se incluye. La API deberá convertirlos a límites UTC explícitos [Desde, Hasta). No se interpretarán instantes sin zona.</p>
      <div className="flex flex-wrap gap-3"><Button type="submit">Aplicar filtros a datos recibidos</Button><Button variant="outline" onClick={() => { form.reset(); setFilters(defaults) }}>Limpiar filtros</Button></div>
    </form>
    <section aria-label="Existencias por bodega" className="space-y-3"><h2 className="text-lg font-semibold">Existencias por bodega</h2><ReceivedTable state={stockRows} columns={inventoryColumns} rowKey={r => `${r.idBodega}-${r.idRepuesto}`} caption="Existencias por bodega" /></section>
    <section aria-label="Movimientos" className="space-y-3"><h2 className="text-lg font-semibold">Movimientos</h2><ReceivedTable state={movementRows} columns={movementColumns} rowKey={r => r.idMovimiento} caption="Movimientos" /></section>
  </>
}
