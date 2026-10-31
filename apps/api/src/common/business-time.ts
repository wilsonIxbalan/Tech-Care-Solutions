/** Representa un instante en Guatemala con offset explícito, sin alterar su valor. */
export function guatemalaInstant(value: Date): string {
  return new Date(value.getTime() - 6 * 60 * 60 * 1000).toISOString().replace('Z', '-06:00');
}

/** Año y mes calendario (1-12) de un instante UTC en Guatemala (UTC-6, sin horario de verano). */
export function guatemalaYearMonth(value: Date): { anio: number; mes: number } {
  const local = new Date(value.getTime() - 6 * 60 * 60 * 1000);
  return { anio: local.getUTCFullYear(), mes: local.getUTCMonth() + 1 };
}
