import { useDraftMessage } from '@/lib/use-draft-message'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, AreaField, SelectField } from '@/components/shared/form-fields'
import { DraftActions } from '@/components/shared/draft-section'
import { createRepuestoSchema } from './repuesto-model'
import type { CategoriaOption } from './repuesto-model'

export function RepuestoForm({ categorias, onCancel }: { categorias?: readonly CategoriaOption[]; onCancel: () => void }) {
  const schema = createRepuestoSchema(categorias)
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { idCategoria: '', codigo: '', nombre: '', descripcion: '', precioCompraReferencia: '', precioVenta: '' } })
  const [message, setMessage] = useDraftMessage(categorias)
  const { errors } = form.formState
  return <form aria-label="Borrador de repuesto" noValidate className="space-y-5" onChange={() => setMessage('')} onSubmit={form.handleSubmit(() => setMessage('Datos válidos. El repuesto aún no se ha guardado; falta conectar la API.'), () => setMessage(''))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField id="repuesto-categoria" label="Categoría" required options={categorias?.map(c => ({ value: String(c.idCategoria), label: c.nombre }))} error={errors.idCategoria?.message} {...form.register('idCategoria')} />
      <TextField id="repuesto-codigo" label="Código" required maxLength={30} error={errors.codigo?.message} {...form.register('codigo')} />
      <TextField id="repuesto-nombre" label="Nombre" required maxLength={120} error={errors.nombre?.message} {...form.register('nombre')} />
      <TextField id="repuesto-compra" label="Precio de compra de referencia" required inputMode="decimal" help="Punto decimal, hasta dos decimales. Se permite cero." error={errors.precioCompraReferencia?.message} {...form.register('precioCompraReferencia')} />
      <TextField id="repuesto-venta" label="Precio de venta" required inputMode="decimal" help="Punto decimal, hasta dos decimales. Se permite cero." error={errors.precioVenta?.message} {...form.register('precioVenta')} />
    </div>
    <AreaField id="repuesto-descripcion" label="Descripción" maxLength={300} error={errors.descripcion?.message} {...form.register('descripcion')} />
    <p className="text-sm text-muted-foreground">La unicidad del código se comprobará en el servidor. Este catálogo no modifica existencias.</p>
    <DraftActions blocked={!categorias?.length} blockedReason={categorias === undefined ? 'Catálogo de categorías pendiente de conexión.' : 'El catálogo recibido no contiene categorías.'} message={message} onCancel={() => { form.reset(); setMessage(''); onCancel() }} />
  </form>
}
