import React, { useMemo, useState } from 'react';
import { Minus, Plus, Save } from 'lucide-react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi } from '../../../lib/medios-api';
import type { MedioLinea, MedioTaxonomia, MedioCampana, MedioPieza } from '../../../types/medios';
import { calcularSLA } from '../lib/businessDays';
import { previewNomenclatura } from '../lib/nomenclatura';
import { ModalShell, Field, ModalActions, inputCls } from './ui';

/**
 * Alta/edición de una línea con dual SLA (steppers +/- recalculando fechas hábiles
 * en vivo con businessDays.ts, mín 1). Taxonomía desde config. El backend recalcula
 * las fechas definitivas al guardar; la nomenclatura es solo previsualización.
 *
 * V2: la línea pertenece a una pieza atada (solicitudId obligatorio); la marca de
 * nomenclatura se fija desde la pieza dueña (piece.marcas[0]).
 */
const LineaFormModal: React.FC<{
  campana: MedioCampana;
  taxonomia: MedioTaxonomia;
  festivos: string[];
  /** Piezas atadas a la campaña (una debe ser la dueña de la línea). */
  piezas: MedioPieza[];
  /** Pieza preseleccionada al abrir desde el panel de piezas. */
  piezaPreseleccionada?: MedioPieza | null;
  linea?: MedioLinea | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ campana, taxonomia, festivos, piezas, piezaPreseleccionada, linea, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);

  const catMedios = Object.keys(taxonomia.mediaMap || {});
  const defCat = linea?.catMedio || (catMedios[0] as any) || 'TTL';
  const mediosDe = (cat: string) => taxonomia.mediaMap?.[cat] || [];

  const [solicitudId, setSolicitudId] = useState<string>(
    linea?.solicitudId || piezaPreseleccionada?.solicitudId || piezas[0]?.solicitudId || '',
  );
  const piezaSel = piezas.find(p => p.solicitudId === solicitudId) || null;

  const [form, setForm] = useState<Partial<MedioLinea>>(() => ({
    catMedio: defCat,
    canal: linea?.canal || mediosDe(defCat)[0] || '',
    formato: linea?.formato || '',
    objetivo: linea?.objetivo || (taxonomia.objetivos?.[0] as any) || 'Awareness',
    audiencia: linea?.audiencia || taxonomia.audiencias?.[0] || '',
    territorio: linea?.territorio || '',
    version: linea?.version || '',
    cantidadPiezas: linea?.cantidadPiezas || 1,
    ratios: linea?.ratios || (taxonomia.ratios?.[0] ? [taxonomia.ratios[0]] : ['16:9']),
    fechaSalidaPauta: linea?.fechaSalidaPauta || '',
    fechaFinPauta: linea?.fechaFinPauta || '',
  }));
  const [diasMontaje, setDiasMontaje] = useState<number>(linea?.diasMontaje ?? 2);
  const [diasRecepcion, setDiasRecepcion] = useState<number>(linea?.diasRecepcion ?? 1);

  const set = (k: keyof MedioLinea, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleRatio = (r: string) =>
    setForm(f => ({ ...f, ratios: f.ratios?.includes(r) ? f.ratios.filter(x => x !== r) : [...(f.ratios || []), r] }));

  // Previsualización de fechas SLA en vivo.
  const sla = useMemo(
    () => calcularSLA(form.fechaSalidaPauta || '', diasMontaje, diasRecepcion, festivos),
    [form.fechaSalidaPauta, diasMontaje, diasRecepcion, festivos],
  );

  // La marca de nomenclatura viene de la pieza dueña (no de la campaña: puede ser multimarca).
  const marcaPieza = piezaSel?.marcas?.[0] || '';
  const nomenclaturaPreview = useMemo(
    () => previewNomenclatura({
      cancha: campana.cancha,
      marca: marcaPieza,
      campana: campana.campanaNombre || campana.title,
      canal: form.canal,
      formato: form.formato,
    }),
    [campana, marcaPieza, form.canal, form.formato],
  );

  const guardar = async () => {
    if (!solicitudId) { notify('Selecciona la pieza dueña de la línea', 'error'); return; }
    if (!form.canal || !form.formato) { notify('Canal y formato son obligatorios', 'error'); return; }
    if (form.fechaSalidaPauta && form.fechaFinPauta && form.fechaFinPauta < form.fechaSalidaPauta) {
      notify('La fecha de fin no puede ser anterior a la de salida', 'error'); return;
    }
    const payload: Partial<MedioLinea> = {
      ...form,
      solicitudId,
      marcaLinea: marcaPieza,
      diasMontaje,
      diasRecepcion,
    };
    setSaving(true);
    try {
      if (linea) {
        await mediosApi.editarLinea(campana.campaignId, linea.lineId, payload);
        notify('Línea actualizada', 'success');
      } else {
        await mediosApi.crearLinea(campana.campaignId, payload);
        notify('Línea agregada', 'success');
      }
      onSaved();
    } catch (e: any) {
      notify(e.message || 'No se pudo guardar la línea', 'error');
    } finally {
      setSaving(false);
    }
  };

  const mediosDeCategoria = mediosDe(form.catMedio as string);

  return (
    <ModalShell title={linea ? 'Editar línea táctica' : 'Nueva línea táctica'} onClose={onClose} wide>
      <Field label="Pieza dueña">
        <select
          className={inputCls}
          value={solicitudId}
          onChange={e => setSolicitudId(e.target.value)}
          disabled={Boolean(linea)}
        >
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
          <select className={inputCls} value={form.catMedio} onChange={e => { const c = e.target.value; setForm(f => ({ ...f, catMedio: c as any, canal: mediosDe(c)[0] || '' })); }}>
            {catMedios.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Objetivo / Funnel">
          <select className={inputCls} value={form.objetivo} onChange={e => set('objetivo', e.target.value)}>
            {(taxonomia.objetivos || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Canal / Medio">
          <select className={inputCls} value={form.canal} onChange={e => set('canal', e.target.value)}>
            {mediosDeCategoria.map(m => <option key={m} value={m}>{m}</option>)}
            {form.canal && !mediosDeCategoria.includes(form.canal) && <option value={form.canal}>{form.canal}</option>}
          </select>
        </Field>
        <Field label="Formato">
          {(taxonomia.formatMap?.[form.canal || ''] || []).length > 0 ? (
            <select className={inputCls} value={form.formato} onChange={e => set('formato', e.target.value)}>
              <option value="">— Selecciona —</option>
              {(taxonomia.formatMap?.[form.canal || ''] || []).map(f => <option key={f} value={f}>{f}</option>)}
              {form.formato && !(taxonomia.formatMap?.[form.canal || ''] || []).includes(form.formato) && <option value={form.formato}>{form.formato}</option>}
            </select>
          ) : (
            <input className={inputCls} value={form.formato || ''} onChange={e => set('formato', e.target.value)} placeholder="Ej. Bumper 6s" />
          )}
        </Field>
        <Field label="Audiencia">
          <select className={inputCls} value={form.audiencia} onChange={e => set('audiencia', e.target.value)}>
            {(taxonomia.audiencias || []).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Territorio comunicación">
          <input className={inputCls} value={form.territorio || ''} onChange={e => set('territorio', e.target.value)} placeholder="Ej. Nutrición Superior" />
        </Field>
        <Field label="Versión">
          <input className={inputCls} value={form.version || ''} onChange={e => set('version', e.target.value)} placeholder="Ej. Lanzamiento V1" />
        </Field>
        <Field label="Cantidad de piezas">
          <input type="number" min={1} className={inputCls} value={form.cantidadPiezas || 1} onChange={e => set('cantidadPiezas', Math.max(1, Number(e.target.value) || 1))} />
        </Field>
      </div>

      <Field label="Aspect ratios">
        <div className="flex gap-2 flex-wrap">
          {(taxonomia.ratios || []).map(r => (
            <button key={r} type="button" onClick={() => toggleRatio(r)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${form.ratios?.includes(r) ? 'bg-brand/10 border-brand/40 text-brand' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      </Field>

      {/* Frame de fechas + dual SLA */}
      <div className="border border-slate-100 dark:border-slate-700 rounded-xl p-3 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">🗓️ Fechas de campaña & dual SLA</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio pauta (aire)">
            <input type="date" className={inputCls} value={form.fechaSalidaPauta || ''} onChange={e => set('fechaSalidaPauta', e.target.value)} />
          </Field>
          <Field label="Fin pauta (aire)">
            <input type="date" className={inputCls} value={form.fechaFinPauta || ''} onChange={e => set('fechaFinPauta', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-600">
          <Stepper label="Días hábiles montaje" value={diasMontaje} onChange={setDiasMontaje} tone="violet" />
          <Field label="Fecha montaje (SLA)">
            <div className="text-[12px] font-bold text-violet-600 dark:text-violet-400 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20">{sla.fechaMontaje || '—'}</div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-600">
          <Stepper label="Días hábiles recepción" value={diasRecepcion} onChange={setDiasRecepcion} tone="amber" />
          <Field label="Fecha recepción (hábil)">
            <div className="text-[12px] font-bold text-amber-600 dark:text-amber-400 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">{sla.fechaRecepcion || '—'}</div>
          </Field>
        </div>
        <p className="text-[10px] text-slate-400">Las fechas definitivas las recalcula el servidor al guardar (días hábiles + festivos).</p>
      </div>

      <div className="text-[10px] text-slate-500">
        <p className="font-bold uppercase tracking-wide text-slate-400">Previsualización nomenclatura</p>
        <code className="block mt-1 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded break-all">{nomenclaturaPreview || '—'}</code>
        <p className="mt-1 text-slate-400">La nomenclatura y la UTM definitivas las genera el servidor al guardar.</p>
      </div>

      <ModalActions saving={saving} onClose={onClose} onSave={guardar} label={linea ? 'Guardar cambios' : 'Guardar línea'} icon={<Save size={14} />} />
    </ModalShell>
  );
};

const Stepper: React.FC<{ label: string; value: number; onChange: (v: number) => void; tone: 'violet' | 'amber' }> = ({ label, value, onChange, tone }) => {
  const color = tone === 'violet' ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400';
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"><Minus size={13} /></button>
        <span className={`text-sm font-bold w-6 text-center ${color}`}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"><Plus size={13} /></button>
        <span className="text-[9px] text-slate-400">días hábiles</span>
      </div>
    </Field>
  );
};

export default LineaFormModal;
