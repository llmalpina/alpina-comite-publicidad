import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
  }).format(value);
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Calcula la fecha de revisión según el ciclo del comité.
 * - Si se sube Lunes a Miércoles antes del corte → próximo lunes
 * - Si se sube Miércoles después del corte, Jueves o Viernes → lunes de la semana subsiguiente
 * 
 * @param cutoffDay - Día de corte (3 = miércoles)
 * @param cutoffHour - Hora de corte
 * @param cutoffMinute - Minuto de corte
 * @param reviewDay - Día de revisión (1 = lunes)
 */
export function calculateNextReviewDate(
  cutoffDay: number = 3,
  cutoffHour: number = 23,
  cutoffMinute: number = 45,
  reviewDay: number = 1
): { date: string; outOfCycle: boolean } {
  const now = new Date();
  const today = now.getDay(); // 0=dom, 1=lun, ..., 6=sáb
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const cutoffMinutes = cutoffHour * 60 + cutoffMinute;
  
  // Determinar si está fuera de ciclo
  const isPastCutoff = today === cutoffDay && currentMinutes >= cutoffMinutes;
  const isAfterCutoffDay = today > cutoffDay && today <= 5; // Jueves o Viernes
  const outOfCycle = isPastCutoff || isAfterCutoffDay;
  
  // Calcular próximo lunes (reviewDay)
  let daysUntilReview = (reviewDay - today + 7) % 7;
  if (daysUntilReview === 0) daysUntilReview = 7; // Si hoy es lunes, ir al próximo
  
  // Si está fuera de ciclo, agregar una semana más
  if (outOfCycle) {
    daysUntilReview += 7;
  }
  
  const reviewDate = new Date(now);
  reviewDate.setDate(reviewDate.getDate() + daysUntilReview);
  reviewDate.setHours(9, 0, 0, 0); // 9:00 AM del día de revisión
  
  return { date: reviewDate.toISOString(), outOfCycle };
}

