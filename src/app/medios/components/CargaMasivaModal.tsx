import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi } from '../../../lib/medios-api';
import type { MedioLinea, MedioTaxonomia, MedioPieza } from '../../../types/medios';
import { ModalShell, Field, ModalActions, inputCls } from './ui';

/**
 * Carga masiva por bloques: genera una línea por cada combinación
 * objetivo × audiencia. Taxonomía desde config. Ratios: todos por defecto.
 *
 * V2: cada línea pertenece a una pieza atada (solicitudId obligatorio en el
 * backend); el modal exige elegir la pieza dueña y fija marcaLinea desde ella.
 */
const CargaMasivaModal: React.FC<{
  campaignId: string;
  taxonomia: MedioTaxonomia;
  piezas: MedioPieza[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ campaignId, taxonomia, piezas, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);

  const [solicitudId, setSolicitudId] = useState<string>(piezas[0]?.solicitudId || '');
  const piezaSel = piezas.find(p => p.solicitudId === solicitudId) || null;
  const marcaPieza = piezaSel?.marcas?.[0] || '';

  const catMedios = Object.keys(taxonomia.mediaMap || {});
  const [catMedio, setCatMedio] = useState(catMedios[0] || 'TTL');
  const mediosDe = (c: string) => taxonomia.mediaMap?.[c] || [];
  const [canal, setCanal] = useState(mediosDe(catMedios[0] || 'TTL')[0] || '');
  const [formato, setFormato] = useState('');
  const [objetivos, setObjetivos] = useState<string[]>(taxonomia.objetivos?.[0] ? [taxonomia.objetivos[0]] : []);
  const [audiencias, setAudiencias] = useState<string[]>(taxonomia.audiencias?.[0] ? [taxonomia.audiencias[0]] : []);
  const [fechaSalidaPauta, setFechaSalidaPauta] = useState('');
  const [fechaFinPauta, setFechaFinPauta] = useState('');

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const ratios = taxonomia.ratios?.length ? taxonomia.ratios : ['16:9', '9:16', '1:1', '4:5'];
  const totalLineas = objetivos.length * audiencias.length;
  const formatos = taxonomia.formatMap?.[canal] || [];

  const guardar = async () => {
    if (!solicitudId) { notify('Selecciona la pieza dueña de las líneas', 'error'); return; }
    if (!canal || !formato) { notify('Canal y formato son obligatorios', 'error'); return; }
    if (totalLineas === 0) { notify('Selecciona al menos un objetivo y una audiencia', 'error'); return; }
    setSaving(true);
    try {
      for (const objetivo of objetivos) {
        for (const audiencia of audiencias) {
          await mediosApi.crearLinea(campaignId, {
            solicitudId, marcaLinea: marcaPieza,
            catMedio: catMedio as any, canal, formato, objetivo: objetivo as any, audiencia,
            ratios, cantidadPiezas: 1, fechaSalidaPauta, fechaFinPauta,
          });
        }
      }
      notify(`${totalLineas} línea(s) creadas`, 'success');
      onSaved();
    } catch (e: any) {
      notify(e.message || 'Error en carga masiva', 'error');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="⚡ Carga masiva por objetivos × audiencias" onClose={onClose} wide>
      <Field label="Pieza dueña">
        <select className={inputCls} value={solicitudId} onChange={e => setSolicitudId(e.target.value)}>
          {piezas.length === 0 && <option value="">— No hay piezas atadas —</option>}
          {piezas.map(p => (
            <option key={p.solicitudId} value={p.solicitudId}>
              {p.consecutive} · {p.title}{p.marcas?.[0] ? ` (${p.marcas[0]})` : ''}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría">
          <select className={inputCls} value={catMedio} onChange={e => { setCatMedio(e.target.value); setCanal(mediosDe(e.target.value)[0] || ''); }}>
            {catMedios.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Canal / Medio">
          <select className={inputCls} value={canal} onChange={e => setCanal(e.target.value)}>
            {mediosDe(catMedio).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Formato">
          {formatos.length > 0 ? (
            <select className={inputCls} value={formato} onChange={e => setFormato(e.target.value)}>
              <option value="">— Selecciona —</option>
              {formatos.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          ) : (
            <input className={inputCls} value={formato} onChange={e => setFormato(e.target.value)} placeholder="Ej. Reels Video" />
          )}
        </Field>
        <Field label="Salida pauta">
          <input type="date" className={inputCls} value={fechaSalidaPauta} onChange={e => setFechaSalidaPauta(e.target.value)} />
        </Field>
        <Field label="Fin pauta">
          <input type="date" className={inputCls} value={fechaFinPauta} onChange={e => setFechaFinPauta(e.target.value)} />
        </Field>
      </div>

      <Field label={`Objetivos (${objetivos.length})`}>
        <div className="flex gap-2 flex-wrap">
          {(taxonomia.objetivos || []).map(o => (
            <button key={o} type="button" onClick={() => toggle(objetivos, setObjetivos, o)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${objetivos.includes(o) ? 'bg-brand/10 border-brand/40 text-brand' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300'}`}>{o}</button>
          ))}
        </div>
      </Field>
      <Field label={`Audiencias (${audiencias.length})`}>
        <div className="flex gap-2 flex-wrap">
          {(taxonomia.audiencias || []).map(a => (
            <button key={a} type="button" onClick={() => toggle(audiencias, setAudiencias, a)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${audiencias.includes(a) ? 'bg-brand/10 border-brand/40 text-brand' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300'}`}>{a}</button>
          ))}
        </div>
      </Field>
      <p className="text-[11px] font-bold text-brand">Se crearán {totalLineas} línea(s) · ratios: {ratios.join(', ')}</p>
      <ModalActions saving={saving} onClose={onClose} onSave={guardar} label={`Crear ${totalLineas} líneas`} icon={<Layers size={14} />} />
    </ModalShell>
  );
};

export default CargaMasivaModal;
