/** Formato y módulo 11 del NIT de Guatemala; no comprueba inscripción en SAT. */
export function validNit(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const nit = value.toUpperCase();
  if (nit === 'CF') return true;
  if (!/^\d{1,11}-?[\dK]$/.test(nit)) return false;
  const digits = nit.replace('-', '');
  const base = digits.slice(0, -1);
  if (/^0+$/.test(base)) return false;
  const sum = [...base].reverse().reduce((total, digit, index) => total + Number(digit) * (index + 2), 0);
  const check = (11 - sum % 11) % 11;
  return digits[digits.length - 1] === (check === 10 ? 'K' : String(check));
}

export const phonePattern = /^(?:\+502[ -]?)?[2-7]\d{3}[ -]?\d{4}$/;
