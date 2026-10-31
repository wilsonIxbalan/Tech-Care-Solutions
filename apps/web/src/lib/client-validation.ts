/** Validación local de formato y dígito verificador; no consulta el RTU. */
export function validNit(value: string): boolean {
  const nit = value.toUpperCase()
  if (nit === 'CF') return true
  if (!/^\d{1,11}-?[\dK]$/.test(nit)) return false
  const digits = nit.replace('-', '')
  const base = digits.slice(0, -1)
  if (/^0+$/.test(base)) return false
  const sum = [...base].reverse().reduce((total, digit, index) => total + Number(digit) * (index + 2), 0)
  const check = (11 - sum % 11) % 11
  return digits.at(-1) === (check === 10 ? 'K' : String(check))
}

export const phonePattern = /^(?:\+502[ -]?)?[2-7]\d{3}[ -]?\d{4}$/
export const nitMessage = 'Escribe un NIT válido con su dígito verificador (por ejemplo, 1234567-9) o CF para consumidor final.'
export const phoneMessage = 'Escribe un teléfono de Guatemala de 8 dígitos, que inicie entre 2 y 7; puedes anteponer +502.'
