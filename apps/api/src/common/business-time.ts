/** Representa un instante en Guatemala con offset explícito, sin alterar su valor. */
export function guatemalaInstant(value: Date): string {
  return new Date(value.getTime() - 6 * 60 * 60 * 1000).toISOString().replace('Z', '-06:00');
}
