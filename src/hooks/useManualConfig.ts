/**
 * Hook para gestionar la configuración del manual de uso.
 * 
 * Persiste en DynamoDB via lambda-maestros:
 *   tipo = 'config-manual' | id = 'singleton'
 * 
 * Estructura:
 *   { pdfS3Key, pdfFileName, gemsUrl, updatedAt }
 */
import { useState, useEffect } from 'react';

export interface ManualConfig {
  pdfS3Key: string;
  pdfFileName: string;
  gemsUrl: string;
  updatedAt?: string;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL as string || '';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('alpina_id_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getUserRole(): string {
  try {
    const devUser = localStorage.getItem('alpina_dev_user');
    if (devUser) return JSON.parse(devUser).role || 'ADMIN';
    const token = localStorage.getItem('alpina_id_token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload['custom:role'] || 'ADMIN';
    }
  } catch {}
  return 'ADMIN';
}

const DEFAULT_CONFIG: ManualConfig = {
  pdfS3Key: '',
  pdfFileName: '',
  gemsUrl: '',
};

export function useManualConfig() {
  const [manualConfig, setManualConfig] = useState<ManualConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  // Cargar configuración desde DynamoDB
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/maestros/config-manual`, {
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        });
        if (res.ok) {
          const items = await res.json();
          const singleton = items.find((i: any) => i.id === 'singleton');
          if (singleton?.value) {
            setManualConfig(singleton.value);
          }
        }
      } catch {
        // Si falla, intenta localStorage como fallback
        try {
          const saved = localStorage.getItem('alpina_manual_config');
          if (saved) setManualConfig(JSON.parse(saved));
        } catch {}
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Guardar configuración
  const saveManualConfig = async (config: Partial<ManualConfig>) => {
    const next = { ...manualConfig, ...config, updatedAt: new Date().toISOString() };
    setManualConfig(next);
    localStorage.setItem('alpina_manual_config', JSON.stringify(next));

    try {
      await fetch(`${API_BASE}/maestros/config-manual/singleton`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          id: 'singleton',
          tipo: 'config-manual',
          value: next,
          updatedAt: next.updatedAt,
          _role: getUserRole(),
        }),
      });
    } catch (err) {
      console.error('Error guardando config del manual:', err);
    }
  };

  // Subir PDF a S3 y guardar la referencia
  const uploadManualPdf = async (file: File): Promise<void> => {
    const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
    const s3Key = `manuales/manual-uso-${Date.now()}.pdf`;

    // 1. Obtener URL presignada
    const presignRes = await fetch(PRESIGN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ action: 'upload', key: s3Key, contentType: 'application/pdf' }),
    });

    if (!presignRes.ok) throw new Error('Error al obtener URL de subida');
    const { url, key: confirmedKey } = await presignRes.json();

    // 2. Subir archivo a S3
    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: file,
    });

    if (!uploadRes.ok) throw new Error('Error al subir PDF a S3');

    // 3. Guardar referencia en config (usar la key confirmada por la lambda)
    await saveManualConfig({ pdfS3Key: confirmedKey || s3Key, pdfFileName: file.name });
  };

  return {
    manualConfig,
    loading,
    saveManualConfig,
    uploadManualPdf,
  };
}
