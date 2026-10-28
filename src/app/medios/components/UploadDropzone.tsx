import React, { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { subirArchivo, kindDeContentType, MEDIOS_ACCEPT, MEDIOS_MAX_SIZE_BYTES } from '../../../lib/medios-upload';

/**
 * Zona de subida de archivos: input + barra de progreso. Valida tipo y tamaño
 * EN CLIENTE antes de pedir presign. Al terminar llama onUploaded para refrescar.
 */
const UploadDropzone: React.FC<{
  campaignId: string;
  scope: 'CAMPANA' | 'PIEZA';
  solicitudId?: string;
  onUploaded: () => void;
}> = ({ campaignId, scope, solicitudId, onUploaded }) => {
  const { notify } = useNotifications();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [drag, setDrag] = useState(false);

  const procesar = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!kindDeContentType(file.type)) {
      notify('Tipo no permitido. Usa video (mp4/mov), audio (mp3/wav), imagen o PDF.', 'error');
      return;
    }
    if (file.size > MEDIOS_MAX_SIZE_BYTES) {
      notify('El archivo supera el máximo permitido (500 MB).', 'error');
      return;
    }
    setSubiendo(true);
    try {
      await subirArchivo(campaignId, file, scope, solicitudId);
      notify(`"${file.name}" se subió correctamente`, 'success');
      onUploaded();
    } catch (e: any) {
      notify(e.message || 'No se pudo subir el archivo', 'error');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!subiendo) procesar(e.dataTransfer.files); }}
      onClick={() => !subiendo && inputRef.current?.click()}
      className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm cursor-pointer transition-colors ${
        drag ? 'border-brand bg-brand/5 text-brand' : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:border-brand hover:text-brand'
      } ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={MEDIOS_ACCEPT}
        className="hidden"
        onChange={e => procesar(e.target.files)}
      />
      {subiendo ? (
        <><Loader2 size={16} className="animate-spin" /> Subiendo…</>
      ) : (
        <><Upload size={16} /> Arrastra o haz clic para subir (video, audio, imagen, PDF)</>
      )}
    </div>
  );
};

export default UploadDropzone;
