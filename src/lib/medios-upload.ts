/**
 * Helper de subida de archivos del módulo de Medios.
 *
 * Sigue el patrón presign → PUT → registrar de src/lib/artes-api.ts: pide una
 * URL firmada a VITE_PRESIGN_URL (acción `upload-media`, FEAT-002), sube el
 * binario a S3 y registra el asset vía mediosApi.registrarAsset (FEAT-001).
 */
import { mediosApi } from './medios-api';
import type { MedioAsset } from '../types/medios';

const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;

/** Content-types permitidos por el backend (espejo de MEDIA_TYPES en lambda-presign). */
export const MEDIOS_CONTENT_TYPES: Record<string, MedioAsset['kind']> = {
  'video/mp4': 'VIDEO',
  'video/quicktime': 'VIDEO',
  'audio/mpeg': 'AUDIO',
  'audio/wav': 'AUDIO',
  'audio/x-wav': 'AUDIO',
  'image/jpeg': 'IMAGEN',
  'image/png': 'IMAGEN',
  'image/webp': 'IMAGEN',
  'image/gif': 'IMAGEN',
  'application/pdf': 'DOCUMENTO',
};

/** Lista de extensiones/tipos aceptados para el atributo `accept` del input. */
export const MEDIOS_ACCEPT = Object.keys(MEDIOS_CONTENT_TYPES).join(',');

/** Tope de tamaño en cliente (el backend no lo acota, protege la UX). */
export const MEDIOS_MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

/** Deriva el `kind` del backend a partir del content-type del archivo. */
export function kindDeContentType(contentType: string): MedioAsset['kind'] | null {
  return MEDIOS_CONTENT_TYPES[contentType] || null;
}

/**
 * Sube un archivo a S3 y registra el asset en la campaña.
 * @throws Error con mensaje legible si falla la validación, el presign, el PUT o el registro.
 */
export async function subirArchivo(
  campaignId: string,
  file: File,
  scope: 'CAMPANA' | 'PIEZA',
  solicitudId?: string,
): Promise<MedioAsset> {
  const kind = kindDeContentType(file.type);
  if (!kind) {
    throw new Error('Tipo de archivo no permitido (video mp4/mov, audio mp3/wav, imagen, pdf)');
  }
  if (file.size > MEDIOS_MAX_SIZE_BYTES) {
    throw new Error('El archivo supera el tamaño máximo permitido (500 MB)');
  }

  const token = localStorage.getItem('alpina_id_token');
  const presignRes = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      action: 'upload-media',
      contentType: file.type,
      fileName: file.name,
      campaignId,
      scope,
      solicitudId: scope === 'PIEZA' ? solicitudId : undefined,
    }),
  });
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({ message: 'No se pudo preparar la subida' }));
    throw new Error(err.message || 'No se pudo preparar la subida del archivo');
  }
  const { url, key } = await presignRes.json();

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error('Falló la subida del archivo a S3');

  return mediosApi.registrarAsset(campaignId, {
    scope,
    solicitudId: scope === 'PIEZA' ? solicitudId : null,
    kind,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    s3Key: key,
  });
}

/** URL presignada de descarga de un asset (acción `download` del presign). */
export async function getMedioDownloadUrl(s3Key: string): Promise<string> {
  const token = localStorage.getItem('alpina_id_token');
  const res = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: 'download', key: s3Key }),
  });
  if (!res.ok) throw new Error('No se pudo obtener el archivo');
  const data = await res.json();
  if (!data.url) throw new Error('El servidor no devolvió una URL de descarga');
  return data.url;
}
