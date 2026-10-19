/**
 * Cliente API del módulo de Medios. Usa apiFetch (incluye token + refresh automático).
 * Todas las rutas /medios* exigen JWT y rol ADMIN en el backend (fase inicial).
 */
import { apiFetch } from './api';
import type { MedioCampana, MedioLinea, MedioEvento } from '../types/medios';

/** Solicitud publicada por el comité, disponible para iniciar en Medios. */
export interface MedioDisponible {
  solicitudId: string;
  consecutive: string;
  title: string;
  marca: string;
  producto: string;
  area: string;
  contentType: string;
  numeroPiezas: number;
  publishedAt: string;
}

export interface MedioCampanaDetalle {
  meta: MedioCampana;
  lineas: MedioLinea[];
  eventos: MedioEvento[];
}

export const mediosApi = {
  /** Piezas publicadas por el comité que aún no se han iniciado en Medios. */
  disponibles: () => apiFetch<MedioDisponible[]>('/medios/disponibles'),
  /** Campañas ya iniciadas en Medios. */
  listCampanas: () => apiFetch<MedioCampana[]>('/medios/campanas'),
  /** Detalle de una campaña (cabecera + líneas + bitácora). */
  getCampana: (id: string) => apiFetch<MedioCampanaDetalle>(`/medios/campanas/${id}`),
  /** Inicia en Medios una solicitud publicada (crea la cabecera de campaña). */
  iniciarCampana: (solicitudId: string, extra?: { cancha?: string; tier?: string }) =>
    apiFetch<MedioCampana>('/medios/campanas', {
      method: 'POST',
      body: JSON.stringify({ solicitudId, ...extra }),
    }),
  /** Agrega una línea táctica a una campaña (nomenclatura y UTM los genera el backend). */
  crearLinea: (campaignId: string, data: Partial<MedioLinea>) =>
    apiFetch<MedioLinea>(`/medios/campanas/${campaignId}/lineas`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
