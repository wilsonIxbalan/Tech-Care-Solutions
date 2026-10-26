/** Centavos exactos. null indica formato no normalizado; nunca convierte un importe a Number. */
export function moneyToMinor(value: string): bigint | null {
  if (!/^\d+\.\d{2}$/.test(value)) return null
  return BigInt(value.replace('.', ''))
}
export function minorToMoney(value: bigint): string {
  const digits = value.toString().padStart(3, '0')
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`
}
