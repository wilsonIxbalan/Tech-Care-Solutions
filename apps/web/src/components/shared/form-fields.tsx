import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

type FieldProps = { id: string; label: string; error?: string; help?: string }

export function TextField({ id, label, error, help, required, ...props }: FieldProps & ComponentProps<'input'>) {
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}{required && ' *'}</Label>
    <Input {...props} id={id} required={required} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} />
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}

export function AreaField({ id, label, error, help, required, ...props }: FieldProps & ComponentProps<'textarea'>) {
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}{required && ' *'}</Label>
    <Textarea {...props} id={id} required={required} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} />
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}

export function SelectField({ id, label, error, help, required, options, placeholder, ...props }: FieldProps & ComponentProps<'select'> & {
  options?: readonly { value: string; label: string }[]; placeholder?: string
}) {
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}{required && ' *'}</Label>
    <NativeSelect {...props} className="min-w-0" id={id} required={required} disabled={props.disabled || !options?.length} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}>
      <option value="">{options === undefined ? 'Pendiente de conexión' : placeholder ?? 'Selecciona una opción'}</option>
      {options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </NativeSelect>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{help ?? (options === undefined ? 'Catálogo pendiente de conexión.' : !options.length ? 'El catálogo recibido no contiene opciones disponibles.' : undefined)}</p>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}
