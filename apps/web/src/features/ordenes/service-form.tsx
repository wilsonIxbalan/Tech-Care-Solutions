import { useRef, useState, type ReactNode } from 'react'
import { useForm, type FieldValues, type Path, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AreaField, SelectField, TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { useServiceMutation } from './api'

export interface ServiceField {
  name: string; label: string; kind?: 'area' | 'select' | 'date'; required?: boolean; maxLength?: number
  help?: string; options?: { value: string; label: string }[]; inputMode?: 'decimal' | 'numeric'
}
function unconfirmedResult(error: Error | null) {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.code === 'RESPUESTA_INVALIDA')
}
export function ServiceError({ error }: { error: Error | null }) {
  if (!error) return null
  return <div role="alert" className="rounded-lg border border-destructive p-3 text-sm">
    <p>{error.message}</p>
    {error instanceof ApiError && <>{error.status === 409 && <p>La operación no se realizó. Revisa el estado actual antes de volver a intentarlo.</p>}
      {Object.entries(error.details ?? {}).map(([field, messages]) => <p key={field}>{field}: {messages.join(' ')}</p>)}
      {error.requestId && <p>Referencia: {error.requestId}</p>}</>}
    {unconfirmedResult(error) && <p>Consulta el estado actualizado antes de repetir esta operación. No se ha confirmado su resultado.</p>}
  </div>
}

/** The form remains mounted on errors; only an acknowledged POST can reset it. */
export function ServiceForm<T extends FieldValues>({ title, path, schema, fields, body, onCancel, onSuccess, children, blocked = false, confirm = false, submitLabel = 'Guardar' }: {
  title: string; path: string; schema: z.ZodType<T>; fields: ServiceField[]; body?: (values: T) => unknown
  onCancel?: () => void; onSuccess?: (data: Record<string, unknown>) => void; children?: ReactNode
  blocked?: boolean; confirm?: boolean; submitLabel?: string
}) {
  const form = useForm<T>({ resolver: zodResolver(schema as never) as Resolver<T>, defaultValues: Object.fromEntries(fields.map(field => [field.name, ''])) as never })
  const mutation = useServiceMutation(path)
  const lock = useRef(false)
  const [confirmation, setConfirmation] = useState(false)
  const [saved, setSaved] = useState(false)
  const unconfirmed = unconfirmedResult(mutation.error)
  async function submit(values: T) {
    if (lock.current || blocked || unconfirmed) return
    if (confirm && !confirmation) { setConfirmation(true); return }
    lock.current = true
    setSaved(false)
    try {
      const result = await mutation.mutateAsync(body ? body(values) : values)
      setSaved(true)
      setConfirmation(false)
      form.reset()
      onSuccess?.(result.data)
    } catch (error) {
      setConfirmation(false)
      if (error instanceof ApiError) Object.entries(error.details ?? {}).forEach(([name, messages]) => {
        if (fields.some(field => field.name === name)) form.setError(name as Path<T>, { type: 'server', message: messages.join(' ') })
      })
    } finally { lock.current = false }
  }
  return <form aria-label={title} noValidate className="space-y-4 rounded-xl border p-4" onSubmit={event => { void form.handleSubmit(submit)(event) }}>
    <h3 className="font-semibold">{title}</h3>
    <fieldset disabled={mutation.isPending} className="space-y-4" onChange={() => { setConfirmation(false); setSaved(false) }}>
      {fields.map(field => {
        const props = { id: `${title}-${field.name}`, label: field.label, required: field.required, help: field.help, error: form.formState.errors[field.name]?.message as string | undefined, ...form.register(field.name as Path<T>) }
        return field.kind === 'area' ? <AreaField key={field.name} {...props} maxLength={field.maxLength} />
          : field.kind === 'select' ? <SelectField key={field.name} {...props} options={field.options ?? []} />
            : <TextField key={field.name} {...props} type={field.kind === 'date' ? 'date' : 'text'} inputMode={field.inputMode} maxLength={field.maxLength} />
      })}
      {children}
    </fieldset>
    <ServiceError error={mutation.error} />
    {saved && <p role="status">Operación registrada. Consulta el estado actualizado de la orden.</p>}
    {confirmation && <p role="status">Revisa los datos. Confirma para registrar esta operación.</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={blocked || mutation.isPending || unconfirmed}>{mutation.isPending ? 'Guardando…' : confirmation ? 'Confirmar operación' : submitLabel}</Button>
      {onCancel && <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onCancel}>Cancelar</Button>}
    </div>
  </form>
}
