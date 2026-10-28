import React, { useState } from 'react';
import { Download, FileText, Image as ImageIcon, Loader2, Music, Trash2, Video } from 'lucide-react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi } from '../../../lib/medios-api';
import { getMedioDownloadUrl } from '../../../lib/medios-upload';
import type { MedioAsset } from '../../../types/medios';
import UploadDropzone from './UploadDropzone';

/** Tamaño legible (B/KB/MB/GB). */
function tamano(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

const ICON: Record<MedioAsset['kind'], React.FC<{ size?: number; className?: string }>> = {
  VIDEO: Video,
  IMAGEN: ImageIcon,
  AUDIO: Music,
  DOCUMENTO: FileText,
};

/**
 * Lista de archivos de una campaña o pieza, con subida (UploadDropzone),
 * descarga (presign) y borrado (gateado por medios_gestionar_lineas).
 */
const AssetsPanel: React.FC<{
  campaignId: string;
  assets: MedioAsset[];
  scope: 'CAMPANA' | 'PIEZA';
  solicitudId?: string;
  titulo?: string;
  puedeGestionar?: boolean;
  onChanged: () => void;
}> = ({ campaignId, assets, scope, solicitudId, titulo, puedeGestionar = true, onChanged }) => {
  const { notify } = useNotifications();
  const [descargando, setDescargando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const descargar = async (a: MedioAsset) => {
    setDescargando(a.assetId);
    try {
      const url = await getMedioDownloadUrl(a.s3Key);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      notify(e.message || 'No se pudo descargar el archivo', 'error');
    } finally {
      setDescargando(null);
    }
  };

  const borrar = async (a: MedioAsset) => {
    if (!window.confirm(`¿Eliminar "${a.fileName}"? Se quita de la lista (el binario queda en S3).`)) return;
    setBorrando(a.assetId);
    try {
      await mediosApi.eliminarAsset(campaignId, a.assetId);
      notify('Archivo eliminado', 'success');
      onChanged();
    } catch (e: any) {
      notify(e.message || 'No se pudo eliminar el archivo', 'error');
    } finally {
      setBorrando(null);
    }
  };

  return (
    <div className="space-y-3">
      {titulo && <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{titulo}</h3>}
      {puedeGestionar && (
        <UploadDropzone campaignId={campaignId} scope={scope} solicitudId={solicitudId} onUploaded={onChanged} />
      )}
      {assets.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">Aún no hay archivos.</p>
      ) : (
        <ul className="space-y-1.5">
          {assets.map(a => {
            const Icon = ICON[a.kind] || FileText;
            return (
              <li key={a.assetId} className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 px-3 py-2">
                <Icon size={18} className="text-violet-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{a.fileName}</p>
                  <p className="text-[11px] text-slate-400">{a.kind} · {tamano(a.sizeBytes)}</p>
                </div>
                <button
                  onClick={() => descargar(a)}
                  disabled={descargando === a.assetId}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  title="Descargar"
                >
                  {descargando === a.assetId ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Descargar
                </button>
                {puedeGestionar && (
                  <button
                    onClick={() => borrar(a)}
                    disabled={borrando === a.assetId}
                    className="text-red-500 hover:text-red-700 shrink-0"
                    title="Eliminar archivo"
                  >
                    {borrando === a.assetId ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AssetsPanel;
