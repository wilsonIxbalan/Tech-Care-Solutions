import { ApiError } from '@/lib/api-client'

export function SaveError({ error }: { error: Error | null }) {
  if (!error) return null
  const ambiguous = !(error instanceof ApiError) || error.status === 0 || error.status >= 500 || error.code === 'RESPUESTA_INVALIDA'
  return <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
    <p>{error.message}</p>
    {error instanceof ApiError && error.details && <ul className="list-inside list-disc">{Object.entries(error.details).flatMap(([field, messages]) => messages.map((message, index) => <li key={`${field}-${index}`}>{field}: {message}</li>))}</ul>}
    {ambiguous && <p>No se pudo confirmar el guardado. Consulta el listado antes de volver a enviar; la operación no se repetirá automáticamente.</p>}
    {error instanceof ApiError && error.requestId && <p className="text-xs text-muted-foreground">Referencia: {error.requestId}</p>}
  </div>
}
