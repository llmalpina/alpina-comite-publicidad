/**
 * Días hábiles con festivos de Colombia — SOLO previsualización en vivo.
 *
 * Espeja la lógica del backend (`restarDiasHabiles`/`esNoHabil`/`calcularSLA` en
 * index.js), que es la fuente de verdad. Ancla cada fecha a `T12:00:00-05:00`
 * (mediodía Bogotá) como el backend, para evitar el corrimiento de día que sufre
 * el prototipo al usar hora local + toISOString UTC (N-1 del DESIGN).
 *
 * El backend SIEMPRE recalcula al persistir; estas utilidades son solo para
 * feedback inmediato en los steppers del dual-SLA.
 */

/** Construye un Date anclado a mediodía Bogotá desde 'YYYY-MM-DD'. */
function bogotaNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00-05:00`);
}

/** Devuelve 'YYYY-MM-DD' de un Date, en zona Bogotá. */
function toISODate(d: Date): string {
  // Formateamos en America/Bogota para evitar corrimiento por UTC.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d); // en-CA produce YYYY-MM-DD
}

/** true si la fecha ISO cae en finde o festivo. */
export function esNoHabil(iso: string, festivos: Set<string> | string[] = []): boolean {
  if (!iso) return false;
  const set = festivos instanceof Set ? festivos : new Set(festivos);
  const d = bogotaNoon(iso);
  const dow = d.getUTCDay(); // el offset fijo -05:00 hace que getUTCDay refleje el día Bogotá
  // Usamos el día calendario Bogotá vía toISODate para el chequeo de festivo.
  const bogotaISO = toISODate(d);
  const localDow = new Date(`${bogotaISO}T12:00:00-05:00`).getUTCDay();
  void dow;
  return localDow === 0 || localDow === 6 || set.has(bogotaISO);
}

/** Resta N días hábiles a una fecha 'YYYY-MM-DD' (saltando finde y festivos). */
export function restarDiasHabiles(iso: string, n: number, festivos: Set<string> | string[] = []): string {
  if (!iso) return '';
  const set = festivos instanceof Set ? festivos : new Set(festivos);
  let d = bogotaNoon(iso);
  let restantes = Math.max(0, Math.floor(n));
  while (restantes > 0) {
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    const curISO = toISODate(d);
    if (!esNoHabil(curISO, set)) restantes--;
  }
  return toISODate(d);
}

/**
 * Calcula las fechas del dual-SLA a partir de la fecha de pauta.
 * montaje = pauta − diasMontaje hábiles; recepción = montaje − diasRecepcion hábiles.
 */
export function calcularSLA(
  fechaSalidaPauta: string,
  diasMontaje: number,
  diasRecepcion: number,
  festivos: Set<string> | string[] = [],
): { fechaMontaje: string; fechaRecepcion: string } {
  if (!fechaSalidaPauta) return { fechaMontaje: '', fechaRecepcion: '' };
  const fechaMontaje = restarDiasHabiles(fechaSalidaPauta, Math.max(1, diasMontaje), festivos);
  const fechaRecepcion = restarDiasHabiles(fechaMontaje, Math.max(1, diasRecepcion), festivos);
  return { fechaMontaje, fechaRecepcion };
}
