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
 * Calcula el próximo lunes o martes (si el lunes es festivo).
 * Retorna la fecha en formato ISO string a las 17:00 (5:00 PM).
 */
export function calculateNextReviewDate(): string {
  const now = new Date();
  const today = now.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  
  // Calcular días hasta el próximo lunes
  let daysUntilMonday = (1 - today + 7) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7; // Si hoy es lunes, ir al próximo lunes
  
  const nextMonday = new Date(now);
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(17, 0, 0, 0);
  
  // TODO: Aquí se podría agregar lógica para detectar festivos en Colombia
  // Por ahora, asumimos que si es lunes, es día hábil. Si no, usar martes.
  // En una implementación real, consultar una API de festivos.
  
  return nextMonday.toISOString();
}

