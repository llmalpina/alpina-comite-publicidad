/**
 * Cliente API del módulo de Medios. Usa apiFetch (incluye token + refresh automático).
 * Todas las rutas /medios* exigen JWT y rol ADMIN en el backend (fase inicial).
 */
import { apiFetch } from './api';
import type { MedioCampana, MedioLinea, MedioEvento, MedioConfig, MedioSpec, MedioTaxonomia, MedioPieza, MedioAsset } from '../types/medios';

/** Solicitud publicada por el comité, disponible para iniciar en Medios. */
export interface MedioDisponible {
  solicitudId: string;
  consecutive: string;
  title: string;
  marca: string;
  /** Marca de la pieza como array (una sola marca por solicitud del comité). */
  marcas: string[];
  producto: string;
  area: string;
  contentType: string;
  numeroPiezas: number;
  publishedAt: string;
}

export interface MedioCampanaDetalle {
  meta: MedioCampana;
  piezas: MedioPieza[];
  lineas: MedioLinea[];
  eventos: MedioEvento[];
  assets: MedioAsset[];
}

/** Resultado de atar piezas a una campaña. */
export interface MedioAtarResult {
  atadas: string[];
  omitidas: { solicitudId: string; motivo: string }[];
  meta: MedioCampana;
}

/** Desglose por campaña del resumen (cumplimiento sobre `activas`). */
export interface MedioResumenCampana {
  total: number;      // total físico (incluye canceladas)
  activas: number;    // no canceladas
  cargadas: number;   // EN_QA && linkMaterial
  enQA: number;       // EN_QA && !linkMaterial
  implementadas: number;
}

/** Resumen para el termómetro de cumplimiento. */
export interface MedioResumen {
  total: number;
  counts: Record<string, number>;
  /** EN_QA con material subido (disjunto de enQA). */
  cargadas: number;
  /** EN_QA sin material todavía (disjunto de cargadas). */
  enQA: number;
  vencidas: number;
  enRiesgo: number;
  alertas: { campaignId: string; lineId: string; canal: string; formato: string; fechaSalidaPauta: string; tipo: 'VENCIDA' | 'RIESGO' }[];
  porCampana: Record<string, MedioResumenCampana>;
}

export const mediosApi = {
  /** Resumen de cumplimiento (contadores por estado + vencidas/en riesgo). */
  resumen: () => apiFetch<MedioResumen>('/medios/resumen'),
  /** Piezas publicadas por el comité que aún no se han iniciado en Medios. */
  disponibles: () => apiFetch<MedioDisponible[]>('/medios/disponibles'),
  /** Campañas ya iniciadas en Medios. */
  listCampanas: () => apiFetch<MedioCampana[]>('/medios/campanas'),
  /** Detalle de una campaña (cabecera + piezas + líneas + bitácora + archivos). */
  getCampana: (id: string) => apiFetch<MedioCampanaDetalle>(`/medios/campanas/${id}`),
  /** Crea una campaña VACÍA (flujo V2); las piezas se atan después. */
  crearCampana: (body: { campanaNombre: string; cancha: string; tier?: string }) =>
    apiFetch<MedioCampana>('/medios/campanas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** @deprecated V1: iniciaba una solicitud publicada creando la campaña 1:1. */
  iniciarCampana: (solicitudId: string, extra?: { cancha?: string; marca?: string; campanaNombre?: string; tier?: string }) =>
    apiFetch<MedioCampana>('/medios/campanas', {
      method: 'POST',
      body: JSON.stringify({ solicitudId, ...extra }),
    }),
  /** Ata una o varias piezas (solicitudes publicadas) a una campaña. */
  atarPiezas: (campaignId: string, solicitudIds: string[]) =>
    apiFetch<MedioAtarResult>(`/medios/campanas/${campaignId}/piezas`, {
      method: 'POST',
      body: JSON.stringify({ solicitudIds }),
    }),
  /** Desata una pieza (cascada: borra sus líneas y archivos de pieza). */
  desatarPieza: (campaignId: string, solicitudId: string) =>
    apiFetch<{ ok: boolean; lineasEliminadas: number; assetsEliminados: number; meta: MedioCampana }>(
      `/medios/campanas/${campaignId}/piezas/${solicitudId}`,
      { method: 'DELETE' },
    ),
  /** Lista los archivos adjuntos de una campaña (desc por uploadedAt). */
  listAssets: (campaignId: string) =>
    apiFetch<{ assets: MedioAsset[] }>(`/medios/campanas/${campaignId}/assets`),
  /** Registra un archivo ya subido a S3 (tras el presign + PUT). */
  registrarAsset: (
    campaignId: string,
    body: {
      scope: 'CAMPANA' | 'PIEZA';
      solicitudId?: string | null;
      lineId?: string | null;
      kind: 'VIDEO' | 'IMAGEN' | 'AUDIO' | 'DOCUMENTO';
      fileName: string;
      contentType: string;
      sizeBytes: number;
      s3Key: string;
    },
  ) =>
    apiFetch<MedioAsset>(`/medios/campanas/${campaignId}/assets`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Elimina el registro de un archivo (no borra el binario de S3). */
  eliminarAsset: (campaignId: string, assetId: string) =>
    apiFetch<{ ok: boolean }>(`/medios/assets/${assetId}?campaignId=${encodeURIComponent(campaignId)}`, {
      method: 'DELETE',
    }),
  /** Edita la cabecera de campaña (cancha/marca/campanaNombre/tier). */
  editarCampana: (campaignId: string, body: { cancha?: string; marca?: string; campanaNombre?: string; tier?: 'T1' | 'T2' | 'T3' }) =>
    apiFetch<MedioCampana>(`/medios/campanas/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** Agrega una línea táctica a una campaña (nomenclatura y UTM los genera el backend). */
  crearLinea: (campaignId: string, data: Partial<MedioLinea>) =>
    apiFetch<MedioLinea>(`/medios/campanas/${campaignId}/lineas`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  /** Carga el material de una línea (link + URL destino). Pasa la línea a EN_QA. */
  cargarMaterial: (campaignId: string, lineId: string, data: { linkMaterial: string; urlDestino?: string }) =>
    apiFetch<MedioLinea>(`/medios/lineas/${lineId}/material`, {
      method: 'PATCH',
      body: JSON.stringify({ campaignId, ...data }),
    }),
  /** Cambia el estado QA de una línea. Al APROBAR exige urlDefinitiva (https). */
  cambiarEstado: (campaignId: string, lineId: string, estado: string, extra?: { nota?: string; urlDefinitiva?: string }) =>
    apiFetch<MedioLinea>(`/medios/lineas/${lineId}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ campaignId, estado, ...extra }),
    }),
  /** Edita campos de una línea (recalcula nomenclatura/UTM y SLA). */
  editarLinea: (campaignId: string, lineId: string, data: Partial<MedioLinea>) =>
    apiFetch<MedioLinea>(`/medios/lineas/${lineId}/editar`, {
      method: 'PATCH',
      body: JSON.stringify({ campaignId, ...data }),
    }),
  /** Elimina una línea. */
  eliminarLinea: (campaignId: string, lineId: string) =>
    apiFetch<{ ok: boolean }>(`/medios/lineas/${lineId}`, {
      method: 'DELETE',
      body: JSON.stringify({ campaignId }),
    }),

  // ─── Configuración / taxonomía / specs ───────────────────────────────────────

  /** Lee taxonomía + specs + config operativa (lazy-init en backend si faltan). */
  getConfig: () => apiFetch<MedioConfig>('/medios/config'),
  /**
   * Edita la taxonomía (canchas/marcas/objetivos/audiencias/ratios/mapas).
   * Concurrencia optimista: `updatedAt` debe coincidir con el persistido (→409).
   */
  patchTaxonomia: (body: Partial<MedioTaxonomia> & { updatedAt: string }) =>
    apiFetch<MedioTaxonomia>('/medios/config/taxonomia', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** Crea una ficha de spec en el catálogo master. */
  crearSpec: (body: Partial<MedioSpec>) =>
    apiFetch<MedioSpec>('/medios/config/specs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Edita una ficha de spec. */
  editarSpec: (specId: string, body: Partial<MedioSpec>) =>
    apiFetch<MedioSpec>(`/medios/config/specs/${specId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** Elimina una ficha de spec (no bloquea aunque haya líneas que la usen). */
  eliminarSpec: (specId: string) =>
    apiFetch<{ ok: boolean }>(`/medios/config/specs/${specId}`, {
      method: 'DELETE',
    }),
};
