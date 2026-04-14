import { ContentType, RequestStatus, UserRole } from '../types';

export const BRANDS = ['Alpina', 'Bon Yurt', 'Alpin', 'Finesse', 'Yox', 'Avena Alpina', 'Arequipe Alpina', 'Baby Gü', 'Regeneris'];

export const CONTENT_TYPES: { label: string; value: ContentType }[] = [
  { label: 'Imagen Estática', value: 'IMAGEN_ESTATICA' },
  { label: 'Video', value: 'VIDEO' },
  { label: 'Post Redes Sociales', value: 'POST_REDES' },
  { label: 'Material POP', value: 'MATERIAL_POP' },
  { label: 'Prensa', value: 'PRENSA' },
  { label: 'Televisión', value: 'TV' },
  { label: 'Otro', value: 'OTRO' },
];

export const CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Punto de Venta', 'Televisión', 'Radio', 'Valla / Exterior', 'E-commerce'];

export const STATUS_LABELS: Record<RequestStatus, { label: string; color: string }> = {
  BORRADOR:              { label: 'Borrador',           color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300' },
  ENVIADA:               { label: 'Enviada',            color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
  PREVALIDACION_IA:      { label: 'Pre-validación IA',  color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' },
  EN_REVISION:           { label: 'En Revisión',        color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' },
  CONSOLIDACION:         { label: 'Consolidación',      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400' },
  APROBADA:              { label: 'Sin comentarios',    color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' },
  APROBADA_OBSERVACIONES:{ label: 'Con comentarios',   color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400' },
  RECHAZADA:             { label: 'Rechazada',          color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
  PUBLICADA:             { label: 'Publicada',          color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-400' },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SOLICITANTE: 'Solicitante',
  REVISOR_ARA: 'Revisor ARA & Nutrición',
  REVISOR_LEGAL: 'Revisor Legal',
  ADMIN: 'Administrador',
};

export const WEEKLY_HOURS_LIMIT = 20;
