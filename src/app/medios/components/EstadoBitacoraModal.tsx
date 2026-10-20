import React, { useState } from 'react';
import { History } from 'lucide-react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi } from '../../../lib/medios-api';
import { formatDate } from '../../../lib/utils';
import { MEDIO_ESTADO_LABELS, MEDIO_TRANSICIONES, type MedioEstadoQA, type MedioLinea, type MedioEvento } from '../../../types/medios';
import { ModalShell, Field, ModalActions, inputCls } from './ui';

/**
 * Modal de estado + bitácora inmutable (§3.3.1, precisión 9). El selector solo
 * ofrece los destinos válidos de TRANSICIONES[estadoActual]; el 409 del backend
 * es red de seguridad. Valida nota no vacía para CANCELADO antes de llamar al
 * API y exige urlDefinitiva https al APROBAR. El autor real es el email del JWT;
 * el nombre escrito se envía como campo informativo.
 */
const EstadoBitacoraModal: React.FC<{
  campaignId: string;
  linea: MedioLinea;
  eventos: MedioEvento[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ campaignId, linea, eventos, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);

  const destinos = MEDIO_TRANSICIONES[linea.estadoQA] || [];
  const [estado, setEstado] = useState<MedioEstadoQA | ''>(destinos[0] || '');
  const [autorNombre, setAutorNombre] = useState('');
  const [nota, setNota] = useState('');
  const [urlDefinitiva, setUrlDefinitiva] = useState('');
  const [notaError, setNotaError] = useState(false);

  // Bitácora de esta línea (inmutable).
  const historial = eventos.filter(ev => ev.lineId === linea.lineId || (!ev.lineId && ev.estadoNuevo));

  const guardar = async () => {
    if (!estado) { notify('No hay transiciones disponibles desde el estado actual', 'error'); return; }
    if (estado === 'CANCELADO' && !nota.trim()) {
      setNotaError(true);
      notify('Indica el motivo de la cancelación', 'error');
      return;
    }
    if (estado === 'APROBADO' && !/^https:\/\/.+/.test(urlDefinitiva.trim())) {
      notify('La URL definitiva debe ser https://', 'error');
      return;
    }
    setNotaError(false);
    setSaving(true);
    try {
      const extra: { nota?: string; urlDefinitiva?: string; autorNombre?: string } = {};
      if (nota.trim()) extra.nota = nota.trim();
      if (autorNombre.trim()) extra.autorNombre = autorNombre.trim();
      if (estado === 'APROBADO') extra.urlDefinitiva = urlDefinitiva.trim();
      await mediosApi.cambiarEstado(campaignId, linea.lineId, estado, extra as any);
      notify('Estado actualizado', 'success');
      onSaved();
    } catch (e: any) {
      notify(e.message || 'No se pudo cambiar el estado', 'error');
    } finally {
      setSaving(false);
    }
  };

  const actual = MEDIO_ESTADO_LABELS[linea.estadoQA] || MEDIO_ESTADO_LABELS.PENDIENTE;

  return (
    <ModalShell title={`🔄 Estado & bitácora · ${linea.canal} ${linea.formato}`} onClose={onClose}>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-slate-400">Estado actual:</span>
        <span className={`font-bold px-2.5 py-0.5 rounded-full ${actual.color}`}>{actual.label}</span>
      </div>

      {destinos.length === 0 ? (
        <p className="text-[12px] text-slate-500 py-2">Este estado es terminal: no hay transiciones disponibles.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre de quien cambia">
              <input className={inputCls} value={autorNombre} onChange={e => setAutorNombre(e.target.value)} placeholder="Tu nombre" />
            </Field>
            <Field label="Nuevo estado QA">
              <select className={inputCls} value={estado} onChange={e => setEstado(e.target.value as MedioEstadoQA)}>
                {destinos.map(d => <option key={d} value={d}>{MEDIO_ESTADO_LABELS[d].label}</option>)}
              </select>
            </Field>
          </div>

          {estado === 'APROBADO' && (
            <Field label="URL definitiva (https)">
              <input className={inputCls} value={urlDefinitiva} onChange={e => setUrlDefinitiva(e.target.value)} placeholder="https://cdn.alpina.com/media/..." />
            </Field>
          )}

          <Field label={estado === 'CANCELADO' ? 'Motivo de cancelación (obligatorio)' : 'Nota / justificación'}>
            <textarea
              className={`${inputCls} resize-none ${notaError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              rows={2}
              value={nota}
              onChange={e => { setNota(e.target.value); if (notaError) setNotaError(false); }}
              placeholder={estado === 'CANCELADO' ? 'Indica el motivo de la cancelación' : 'Opcional'}
            />
          </Field>
          {notaError && <p className="text-[10px] text-red-500 -mt-2">Indica el motivo de la cancelación.</p>}

          <ModalActions saving={saving} onClose={onClose} onSave={guardar} label="Guardar cambio" />
        </>
      )}

      {/* Bitácora inmutable */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5 mb-2"><History size={12} /> Historial</p>
        {historial.length === 0 ? (
          <p className="text-[11px] text-slate-400">Sin eventos registrados.</p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {historial.map(ev => (
              <div key={ev.sk} className="text-[11px] text-slate-500 flex gap-2">
                <span className="text-slate-400 shrink-0">{formatDate(ev.at)}</span>
                <span>{ev.nota} <span className="text-slate-400">· {ev.autor}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default EstadoBitacoraModal;
