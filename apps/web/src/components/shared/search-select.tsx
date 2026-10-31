import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Un solo campo para consultar y elegir un registro; el texto libre no es un ID. */
export function SearchSelect<T>({ id, label, selected, rows, valueOf, labelOf, search, onSearch, onSelect, disabled, required, error, placeholder }: {
  id: string; label: string; selected: T | null; rows: T[]
  valueOf: (row: T) => number | string; labelOf: (row: T) => string
  search: string; onSearch: (text: string) => void; onSelect: (row: T | null) => void
  disabled?: boolean; required?: boolean; error?: string; placeholder?: string
}) {
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(-1)
  function choose(row: T) { onSelect(row); setOpen(false); setActive(-1) }
  return <div className="space-y-2" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <Label htmlFor={id}>{label}{required && ' *'}</Label>
    <Input id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open && !disabled} aria-controls={`${id}-results`}
      aria-activedescendant={open && active >= 0 && rows[active] ? `${id}-option-${active}` : undefined}
      aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      required={required} disabled={disabled} maxLength={150} placeholder={placeholder ?? 'Escribe para buscar y selecciona un resultado'}
      value={selected ? labelOf(selected) : search} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
      onChange={event => { onSearch(event.target.value); onSelect(null); setActive(-1); setOpen(true) }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true)
          setActive(index => !rows.length ? -1 : event.key === 'ArrowDown' ? (index + 1) % rows.length : index <= 0 ? rows.length - 1 : index - 1)
        } else if (event.key === 'Enter' && open) {
          event.preventDefault()
          if (rows[active]) choose(rows[active])
        } else if (event.key === 'Escape') { setOpen(false); setActive(-1) }
      }} />
    {open && !disabled && <ul id={`${id}-results`} role="listbox" aria-label={`Resultados de ${label.toLowerCase()}`} className="max-h-60 overflow-y-auto rounded-md border">
      {rows.map((row, index) => <li key={valueOf(row)}><button id={`${id}-option-${index}`} type="button" role="option" tabIndex={-1}
        aria-selected={selected !== null && valueOf(selected) === valueOf(row)}
        className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${active === index ? 'bg-muted' : ''}`}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(row)}>{labelOf(row)}</button></li>)}
    </ul>}
    <p id={`${id}-help`} className="text-xs text-muted-foreground">Escribe para buscar y elige un resultado. También puedes usar las flechas y Enter. {selected ? `Selección: ${labelOf(selected)}.` : 'El texto escrito por sí solo no selecciona un registro.'}</p>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}
