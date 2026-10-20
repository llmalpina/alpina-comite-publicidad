/**
 * Tipos del módulo de Medios — Cuadro de Materiales & QA Audiovisual.
 *
 * Módulo nuevo, independiente del comité, que arranca cuando una solicitud del
 * comité pasa a PUBLICADA (se "habilita" en Medios). Ver Medios/PLAN_MODULO_MEDIOS.md.
 *
 * FASE INICIAL: solo visible/accesible para ADMIN.
 */

/** Estados QA de una pieza/línea de material (lista cerrada). */
export type MedioEstadoQA =
  | 'PENDIENTE'       // línea creada, sin material
  | 'EN_QA'           // material cargado, en validación
  | 'RECHAZADO'       // falló checkpoint de QA
  | 'APROBADO'        // QA superado, URL definitiva lista
  | 'IMPLEMENTADO'    // pautado en canal
  | 'VENCIDO'         // fecha de salida venció sin estar aprobado/entregado
  | 'CANCELADO';      // cancelado, fuera de flujo (reversible a PENDIENTE por admin)

/** Categoría de medio. */
export type MedioCategoria = 'TTL' | 'ATL' | 'BTL';

/** Objetivo / funnel. */
export type MedioObjetivo = 'Awareness' | 'Consideración' | 'Conversión' | 'Sostenimiento';

/** Modo en que la publicación del comité impacta a Medios (config del módulo). */
export type MedioTriggerMode = 'HABILITAR' | 'AUTO_CREAR';

/** Cabecera de una campaña/entrada de Medios (siempre referencia una solicitud publicada). */
export interface MedioCampana {
  campaignId: string;
  /** Solicitud del comité que la originó (obligatorio: todo pasa por el comité). */
  solicitudId: string;
  consecutive: string;
  cancha: string;
  marca: string;
  /** Nombre corto de campaña para la jerarquía; si falta se usa `title`. */
  campanaNombre?: string;
  /** Producto desnormalizado de la solicitud (opcional). */
  producto?: string;
  tier?: 'T1' | 'T2' | 'T3';
  title: string;
  estadoAgregado: MedioEstadoQA;
  totalPiezas: number;
  createdAt: string;
  updatedAt: string;
}

/** Línea/pieza táctica dentro de una campaña. */
export interface MedioLinea {
  campaignId: string;
  lineId: string;
  solicitudId: string;
  catMedio: MedioCategoria;
  canal: string;
  formato: string;
  ratios: string[];
  objetivo: MedioObjetivo;
  audiencia: string;
  territorio?: string;
  version: string;
  cantidadPiezas: number;
  fechaSalidaPauta: string;
  fechaFinPauta: string;
  fechaSLAEntrega?: string;
  fechaMontaje?: string;
  fechaRecepcion?: string;
  diasMontaje?: number;
  diasRecepcion?: number;
  estadoQA: MedioEstadoQA;
  /** Generados por el backend, read-only. */
  nomenclaturaAuto?: string;
  utmAuto?: string;
  linkMaterial?: string | null;
  urlDestino?: string | null;
  urlDefinitiva?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Registro inmutable de la bitácora de una campaña/línea. */
export interface MedioEvento {
  campaignId: string;
  sk: string;              // event#<timestamp>
  lineId?: string;
  autor: string;
  estadoAnterior?: MedioEstadoQA;
  estadoNuevo?: MedioEstadoQA;
  nota: string;
  at: string;
}

/** Etiquetas y colores de los estados QA (para la UI). */
export const MEDIO_ESTADO_LABELS: Record<MedioEstadoQA, { label: string; color: string }> = {
  PENDIENTE:    { label: 'Pendiente',    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
  EN_QA:        { label: 'En QA',        color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' },
  RECHAZADO:    { label: 'Rechazado',    color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
  APROBADO:     { label: 'Aprobado',     color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400' },
  IMPLEMENTADO: { label: 'Implementado', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-400' },
  VENCIDO:      { label: 'Vencido',      color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  // Gris/slate: "cancelado" es fuera de flujo (neutro), se distingue de rechazado/vencido (rojo). §3.2
  CANCELADO:    { label: 'Cancelado',    color: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
};

/**
 * Transiciones válidas de la máquina de estados QA (espejo del backend §3.3).
 * El modal de estado solo ofrece los destinos de TRANSICIONES[estadoActual].
 * `VENCIDO` queda inerte (sin disparador de UI en esta fase, N-3).
 */
export const MEDIO_TRANSICIONES: Record<MedioEstadoQA, MedioEstadoQA[]> = {
  PENDIENTE:    ['EN_QA', 'VENCIDO', 'CANCELADO'],
  EN_QA:        ['APROBADO', 'RECHAZADO', 'CANCELADO'],
  RECHAZADO:    ['EN_QA', 'CANCELADO'],
  APROBADO:     ['IMPLEMENTADO', 'EN_QA'],
  IMPLEMENTADO: [],
  VENCIDO:      ['EN_QA', 'CANCELADO'],
  CANCELADO:    ['PENDIENTE'],
};

// ─── Taxonomía / configuración del módulo (items config#* del backend) ─────────

/** Ficha técnica de un formato (catálogo master de specs). */
export interface MedioSpec {
  id: string;
  catMedio: MedioCategoria;
  medio: string;
  formato: string;
  ratios: string[];
  duracion?: string;
  fileTypes?: string;
  audioLufs?: string;
  copyLimits?: string;
  linkSpecs?: string;
  notes?: string;
  /** Peso máximo del archivo; opcional, "No especificado" si falta. */
  maxWeight?: string;
}

/** Marca asociada a una cancha. */
export interface MedioMarca {
  nombre: string;
  cancha: string;
}

/** Catálogo de canchas/marcas/objetivos/audiencias/ratios y mapas de taxonomía. */
export interface MedioTaxonomia {
  canchas: string[];
  marcas: MedioMarca[];
  objetivos: string[];
  audiencias: string[];
  ratios: string[];
  mediaMap: Record<string, string[]>;
  formatMap: Record<string, string[]>;
  updatedAt: string;
}

/** Config operativa del módulo (festivos, SLA default, trigger). */
export interface MedioConfigModulo {
  triggerMode: MedioTriggerMode;
  slaMontajeDiasHabiles: number;
  slaRecepcionDiasHabiles: number;
  alertaVencidasHoras: number;
  festivos: string[];
  updatedAt: string;
}

/** Respuesta de GET /medios/config. */
export interface MedioConfig {
  taxonomia: MedioTaxonomia;
  specs: MedioSpec[];
  modulo: MedioConfigModulo;
}

/** Modo de agrupación del eje Y del Gantt (literales exactos del prototipo). */
export type GanttGrouping = 'FORMAT' | 'MEDIO' | 'TIPO_MEDIO' | 'OBJETIVO' | 'AUDIENCIA';
