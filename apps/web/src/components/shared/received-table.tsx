import type { ReactNode } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ReceivedData } from '@/lib/received-data'

export function ReceivedTable<T>({ state = { status: 'pending' }, columns, rowKey, caption }: {
  state?: ReceivedData<T>; columns: readonly { title: string; cell: (row: T) => ReactNode }[]; rowKey: (row: T) => string | number; caption: string
}) {
  if (state.status === 'pending') return <EmptyState title="Consulta pendiente de conexión" description={`${caption}: los datos deben recibirse de la API. Todavía no se ha consultado.`} />
  if (state.status === 'loading') return <LoadingState label={`Consultando ${caption}…`} />
  if (state.status === 'error') return <ErrorState description={state.message} />
  if (!state.data.length) return <EmptyState title="Consulta sin resultados" description="La consulta recibida no contiene filas para estos filtros." />
  return <Table><caption className="sr-only">{caption}</caption><TableHeader><TableRow>{columns.map(column => <TableHead key={column.title}>{column.title}</TableHead>)}</TableRow></TableHeader><TableBody>{state.data.map(row => <TableRow key={rowKey(row)}>{columns.map(column => <TableCell className="max-w-sm break-words" key={column.title}>{column.cell(row) ?? '—'}</TableCell>)}</TableRow>)}</TableBody></Table>
}
