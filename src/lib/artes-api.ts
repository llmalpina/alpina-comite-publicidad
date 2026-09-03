/**
 * Cliente del módulo de aprobación de artes por equipos.
 * Usa el mismo API Gateway y el mismo helper que el resto de la app.
 */
import { apiFetch } from './api';
import type {
  ArteDetailResponse, ArteDecision, ArtesConfig, ArtesListResponse, ArteFlow, ArteVersion,
} from '../types/artes';

const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;

/**
 * Identidad de respaldo para el modo Dev.
 *
 * En producción la identidad la resuelve el Cognito Authorizer del API Gateway
 * a partir del JWT que `apiFetch` envía en el header Authorization. El backend
 * SIEMPRE usa esos claims. Este respaldo solo cubre el "modo Dev" local (sin
 * token real): se manda en el body/query y el backend lo ignora cuando hay
 * claims verificados del authorizer.
 */
function devIdentity(): Record<string, string> {
  try {
    const devUser = localStorage.getItem('alpina_dev_user');
    if (devUser) {
      const u = JSON.parse(devUser);
      return { _role: u.role || 'SOLICITANTE', _email: u.email || '', _userName: u.name || '', _userId: u.id || '' };
    }
  } catch { /* sin respaldo */ }
  return {};
}

/** Los filtros del listado viajan como query params */
function toQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

export const artesApi = {
  /** Configuración de equipos, orden y recordatorios */
  getConfig: () => apiFetch<ArtesConfig>('/artes/config'),

  saveConfig: (config: ArtesConfig) =>
    apiFetch<ArtesConfig>('/artes/config', {
      method: 'PUT',
      body: JSON.stringify({ value: config, ...devIdentity() }),
    }),

  /** Cola / repositorio: el backend ya filtra por los equipos del usuario */
  list: (filters: { estado?: string; teamId?: string; brand?: string; q?: string } = {}) =>
    apiFetch<ArtesListResponse>(`/artes${toQuery({ ...filters, ...devIdentity() })}`),

  get: (solicitudId: string) => apiFetch<ArteDetailResponse>(`/artes/${solicitudId}${toQuery(devIdentity())}`),

  /** Inicia el flujo manualmente. assignees: { teamId: email } responsable por equipo. */
  start: (solicitudId: string, force = false, assignees?: Record<string, string>) =>
    apiFetch<ArteFlow>('/artes', {
      method: 'POST',
      body: JSON.stringify({ solicitudId, force, assignees: assignees || {}, ...devIdentity() }),
    }),

  /** Firma o devuelve el arte en nombre del equipo */
  decidir: (solicitudId: string, data: { teamId: string; decision: ArteDecision; comment?: string }) =>
    apiFetch<{ flow: ArteFlow }>(`/artes/${solicitudId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ ...data, ...devIdentity() }),
    }),

  /** Registra un ajuste de Diseño: reinicia el ciclo de firmas */
  crearVersion: (solicitudId: string, data: { s3Key: string; fileName: string; fileSize: number; changeNote?: string }) =>
    apiFetch<{ flow: ArteFlow; version: ArteVersion }>(`/artes/${solicitudId}/versiones`, {
      method: 'POST',
      body: JSON.stringify({ ...data, ...devIdentity() }),
    }),

  /** Envía el recordatorio de pendientes en el momento (sin esperar el cron) */
  enviarRecordatorio: () =>
    apiFetch<{ equipos: { teamId: string; enviado: boolean; piezas?: number }[]; totalPendientes: number }>(
      '/artes/recordatorio',
      { method: 'POST', body: JSON.stringify(devIdentity()) },
    ),
};

// ─── S3 ───────────────────────────────────────────────────────────────────────

/** URL presignada de descarga para el PDF del arte */
export async function getArteDownloadUrl(s3Key: string): Promise<string> {
  const token = localStorage.getItem('alpina_id_token');
  const res = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: 'download', key: s3Key }),
  });
  if (!res.ok) throw new Error('No se pudo obtener el PDF del arte');
  const data = await res.json();
  if (!data.url) throw new Error('El servidor no devolvió una URL de descarga');
  return data.url;
}

/**
 * Sube una versión corregida del arte a S3.
 * Usa el mismo bucket y la misma estructura de prefijos que el comité
 * (App comite publicidad/solicitudes/{solicitudId}/...).
 */
export async function uploadArteVersion(
  solicitudId: string,
  file: File,
  versionNumber: number,
): Promise<{ s3Key: string }> {
  const token = localStorage.getItem('alpina_id_token');
  const presignRes = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      action: 'upload',
      solicitudId,
      fileName: file.name,
      version: versionNumber,
      contentType: 'application/pdf',
    }),
  });
  if (!presignRes.ok) throw new Error('No se pudo preparar la subida del arte');
  const { url, key } = await presignRes.json();

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  });
  if (!putRes.ok) throw new Error('Falló la subida del arte a S3');
  return { s3Key: key };
}
