import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type FieldProps = { id: string; label: string; error?: string; help?: string }

function descriptions(id: string, help?: string, error?: string, supplied?: string) {
  return [supplied, help ? `${id}-help` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined
}

export function TextField({ id, label, error, help, required, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: FieldProps & ComponentProps<'input'>) {
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}{required && ' *'}</Label>
    <Input {...props} id={id} required={required} aria-invalid={error ? true : invalid} aria-describedby={descriptions(id, help, error, describedBy)} />
    {help && <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}

export function AreaField({ id, label, error, help, required, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: FieldProps & ComponentProps<'textarea'>) {
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}{required && ' *'}</Label>
    <Textarea {...props} id={id} required={required} aria-invalid={error ? true : invalid} aria-describedby={descriptions(id, help, error, describedBy)} />
    {help && <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}

export function SelectField({ id, label, error, help, required, options, placeholder, className, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: FieldProps & ComponentProps<'select'> & {
  options?: readonly { value: string; label: string }[]; placeholder?: string
}) {
  const explanation = help ?? (options === undefined ? 'Catálogo pendiente de conexión.' : !options.length ? 'El catálogo recibido no contiene opciones disponibles.' : undefined)
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}{required && ' *'}</Label>
    <NativeSelect {...props} className={cn('min-w-0', className)} id={id} required={required} disabled={props.disabled || !options?.length} aria-invalid={error ? true : invalid} aria-describedby={descriptions(id, explanation, error, describedBy)}>
      <option value="">{options === undefined ? 'Pendiente de conexión' : !options.length ? 'Sin opciones disponibles' : placeholder ?? 'Selecciona una opción'}</option>
      {options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </NativeSelect>
    {explanation && <p id={`${id}-help`} className="text-xs text-muted-foreground">{explanation}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}
