import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Vitest desactiva CSS por defecto; leer la fuente real, no su modulo vacio.
const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

function color(name: string): string {
  const value = css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
  if (!value) throw new Error('Token de color no encontrado: ' + name)
  const reference = value.match(/^var\(--([\w-]+)\)$/)
  return reference ? color(reference[1]) : value
}
function luminance(hex: string) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map(c => c + c).join('') : value
  const rgb = [0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
function contrast(a: string, b: string) {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (bright + 0.05) / (dark + 0.05)
}
describe('Contraste de la identidad ERP', () => {
  it('encabezados y boton primario mantienen contraste AA para texto pequeno', () => {
    expect(contrast(color('color-primary-foreground'), color('color-table-header'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(color('color-primary-foreground'), color('color-primary'))).toBeGreaterThanOrEqual(4.5)
  })
  it('bordes de entrada y foco se distinguen de la superficie blanca', () => {
    expect(contrast(color('color-input'), color('card'))).toBeGreaterThanOrEqual(3)
    expect(contrast(color('color-ring'), color('card'))).toBeGreaterThanOrEqual(3)
  })
  it('texto y enlaces siguen legibles en filas alternas, hover y seleccionadas', () => {
    for (const background of ['color-table-stripe', 'color-table-hover', 'color-table-selected']) {
      expect(contrast(color('foreground'), color(background))).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(color('primary'), color('color-table-stripe'))).toBeGreaterThanOrEqual(4.5)
  })
})
