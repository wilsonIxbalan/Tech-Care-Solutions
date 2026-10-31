import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Label, RequiredMark } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { FieldHelp } from '@/components/shared/field-help'
import { cn } from '@/lib/utils'

type FieldProps = { id: string; label: string; error?: string; help?: string }

function descriptions(id: string, help?: string, error?: string, supplied?: string) {
  return [supplied, help ? `${id}-help` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined
}

export function TextField({ id, label, error, help, required, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: FieldProps & ComponentProps<'input'>) {
  // INT y DECIMAL(12,2): limitar tambien la entrada nativa, ademas del esquema.
  const limit = props.maxLength ?? (props.inputMode === 'numeric' ? 10 : props.inputMode === 'decimal' ? 13 : undefined)
  const explanation = [help, limit ? `Máximo ${limit} caracteres.` : undefined].filter(Boolean).join(' ')
  return <div className="relative min-w-0 space-y-2">
    <Label className={explanation ? 'pr-8' : undefined} htmlFor={id}>{label}{required && <RequiredMark />}</Label>
    <Input {...props} maxLength={limit} id={id} required={required} aria-invalid={error ? true : invalid ?? false} aria-describedby={descriptions(id, explanation, error, describedBy)} />
    {explanation && <div className="absolute right-0 top-0"><FieldHelp label={label} text={explanation} /></div>}
    {explanation && <p id={`${id}-help`} className="text-xs text-muted-foreground">{explanation}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}

export function AreaField({ id, label, error, help, required, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: FieldProps & ComponentProps<'textarea'>) {
  const explanation = [help, props.maxLength ? `Máximo ${props.maxLength} caracteres.` : undefined].filter(Boolean).join(' ')
  return <div className="relative min-w-0 space-y-2">
    <Label className={explanation ? 'pr-8' : undefined} htmlFor={id}>{label}{required && <RequiredMark />}</Label>
    <Textarea {...props} id={id} required={required} aria-invalid={error ? true : invalid ?? false} aria-describedby={descriptions(id, explanation, error, describedBy)} />
    {explanation && <div className="absolute right-0 top-0"><FieldHelp label={label} text={explanation} /></div>}
    {explanation && <p id={`${id}-help`} className="text-xs text-muted-foreground">{explanation}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}

export function SelectField({ id, label, error, help, required, options, placeholder, allowEmpty = !required, className, onChange, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: FieldProps & ComponentProps<'select'> & {
  options?: readonly { value: string; label: string }[]; placeholder?: string; allowEmpty?: boolean
}) {
  const explanation = help ?? (options === undefined ? 'Catálogo pendiente de conexión.' : !options.length ? 'El catálogo recibido no contiene opciones disponibles.' : undefined)
  return <div className="relative min-w-0 space-y-2">
    <Label className={help ? 'pr-8' : undefined} htmlFor={id}>{label}{required && <RequiredMark />}</Label>
    <NativeSelect {...props} className={cn('min-w-0', className)} id={id} required={required} disabled={props.disabled || !options?.length} aria-invalid={error ? true : invalid ?? false} aria-describedby={descriptions(id, explanation, error, describedBy)} onChange={event => {
      if ((!allowEmpty || required) && !event.currentTarget.value) return
      onChange?.(event)
    }}>
      {(allowEmpty || required || !options?.length) && <option value="" disabled={!allowEmpty || required} hidden={!allowEmpty || required}>{options === undefined ? 'Pendiente de conexión' : !options.length ? 'Sin opciones disponibles' : placeholder ?? 'Selecciona una opción'}</option>}
      {options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </NativeSelect>
    {help && <div className="absolute right-0 top-0"><FieldHelp label={label} text={help} /></div>}
    {explanation && <p id={`${id}-help`} className="text-xs text-muted-foreground">{explanation}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}
