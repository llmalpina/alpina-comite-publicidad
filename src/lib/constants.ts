import { ContentType, RequestStatus, UserRole } from '../types';

export const BRANDS = ['Alpina', 'Bon Yurt', 'Alpin', 'Finesse', 'Yox', 'Avena Alpina', 'Arequipe Alpina', 'Baby Gü', 'Regeneris'];

export const CONTENT_TYPES: { label: string; value: ContentType }[] = [
  { label: 'Parrilla digital, TikTok y marca', value: 'PARRILLA_DIGITAL' },
  { label: 'Parrilla de marcas / cuadro de materiales', value: 'PARRILLA_MARCAS' },
  { label: 'Guiones para creadores de contenido', value: 'GUIONES_CREADORES' },
  { label: 'Malla OOH (Out-of-Home)', value: 'MALLA_OOH' },
  { label: 'Paquete de artes de una marca', value: 'PAQUETE_ARTES' },
  { label: 'Guiones y storyboards de comerciales TV', value: 'GUIONES_TV' },
  { label: 'Matriz de copys y cuadros de texto', value: 'MATRIZ_COPYS' },
  { label: 'Q&A de campañas', value: 'QA_CAMPANAS' },
  { label: 'Landing, web, email marketing', value: 'LANDING_WEB_EMAIL' },
  { label: 'Paquete POP punto de venta', value: 'PAQUETE_POP' },
  { label: 'Comunicados de prensa y publirreportajes', value: 'COMUNICADOS_PRENSA' },
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
