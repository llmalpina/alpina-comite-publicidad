import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, Film, History, Hash, Link2, X } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../lib/utils';
import { useNotifications } from '../../contexts/NotificationContext';
import { mediosApi, type MedioCampanaDetalle } from '../../lib/medios-api';
import { MEDIO_ESTADO_LABELS, type MedioLinea } from '../../types/medios';

// Taxonomías (alineadas con el prototipo v78.0).
const MEDIA_MAP: Record<string, string[]> = {
  TTL: ['YouTube', 'TikTok Ads', 'Meta Ads', 'Google Display'],
  ATL: ['Televisión Nacional', 'Televisión Regional', 'Radio', 'Vallas OOH'],
  BTL: ['Material POP', 'Trade Marketing', 'Eventos y Activaciones'],
};
const OBJETIVOS = ['Awareness', 'Consideración', 'Conversión', 'Sostenimiento'];
const AUDIENCIAS = ['Young Snackers (18-24)', 'Snackers (25-50)', 'Prácticos (20-40)', 'Salud y Bienestar (30-54)', 'Home Cookers (+25)'];
const RATIOS = ['16:9', '9:16', '1:1', '4:5'];

const CampanaDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { notify } = useNotifications();
  const [data, setData] = useState<MedioCampanaDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const cargar = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await mediosApi.getCampana(id));
    } catch (e: any) {
      notify(e.message || 'No se pudo cargar la campaña', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="animate-spin mr-2" size={20} /> Cargando…</div>;
  if (!data) return <div className="text-center py-16 text-slate-500">Campaña no encontrada. <Link to="/medios" className="text-violet-600 underline">Volver</Link></div>;

  const { meta, lineas, eventos } = data;
  const estado = MEDIO_ESTADO_LABELS[meta.estadoAgregado] || MEDIO_ESTADO_LABELS.PENDIENTE;

  return (
    <div className="space-y-5">
      <Link to="/medios" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600">
        <ArrowLeft size={16} /> Volver a Medios
      </Link>

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Film className="text-violet-600 dark:text-violet-400" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{meta.title}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{meta.consecutive} · {meta.marca}{meta.producto ? ` · ${meta.producto}` : ''}</p>
          </div>
        </div>
        <Badge className={estado.color}>{estado.label}</Badge>
      </div>

      {/* Líneas */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100">Líneas tácticas ({lineas.length})</h2>
            <Button size="sm" className="gap-1" onClick={() => setModalOpen(true)}><Plus size={14} /> Agregar línea</Button>
          </div>
          {lineas.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aún no hay líneas. Agrega la primera pieza táctica (medio, formato, fechas).</p>
          ) : (
            <div className="space-y-2">
              {lineas.map(l => {
                const le = MEDIO_ESTADO_LABELS[l.estadoQA] || MEDIO_ESTADO_LABELS.PENDIENTE;
                return (
                  <div key={l.lineId} className="border border-slate-100 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{l.canal} · {l.formato}</span>
                        <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 text-[9px]">{l.catMedio}</Badge>
                        {l.ratios?.map(r => <span key={r} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600">{r}</span>)}
                      </div>
                      <Badge className={le.color + ' text-[10px]'}>{le.label}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{l.objetivo}{l.audiencia ? ` · ${l.audiencia}` : ''}{l.version ? ` · ${l.version}` : ''} · {l.cantidadPiezas} pieza(s)</p>
                    {(l.fechaSalidaPauta || l.fechaFinPauta) && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Pauta: {l.fechaSalidaPauta || '—'} → {l.fechaFinPauta || '—'}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-slate-500 flex items-center gap-1"><Hash size={11} className="shrink-0" /> <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{l.nomenclaturaAuto}</code></p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1"><Link2 size={11} className="shrink-0" /> <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">{l.utmAuto}</code></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bitácora */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3"><History size={16} /> Bitácora</h2>
          <div className="space-y-2">
            {eventos.map(ev => (
              <div key={ev.sk} className="text-[11px] text-slate-500 flex gap-2">
                <span className="text-slate-400 shrink-0">{formatDate(ev.at)}</span>
                <span>{ev.nota} <span className="text-slate-400">· {ev.autor}</span></span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {modalOpen && <NuevaLineaModal campaignId={meta.campaignId} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); cargar(); }} />}
    </div>
  );
};

// ─── Modal de nueva línea ──────────────────────────────────────────────────────

const NuevaLineaModal: React.FC<{ campaignId: string; onClose: () => void; onSaved: () => void }> = ({ campaignId, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<MedioLinea>>({
    catMedio: 'TTL', canal: MEDIA_MAP.TTL[0], formato: '', objetivo: 'Awareness',
    audiencia: AUDIENCIAS[0], version: '', cantidadPiezas: 1, ratios: ['16:9'],
    fechaSalidaPauta: '', fechaFinPauta: '',
  });

  const set = (k: keyof MedioLinea, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleRatio = (r: string) => setForm(f => ({ ...f, ratios: f.ratios?.includes(r) ? f.ratios.filter(x => x !== r) : [...(f.ratios || []), r] }));

  const guardar = async () => {
    if (!form.canal || !form.formato) { notify('Canal y formato son obligatorios', 'error'); return; }
    if (form.fechaSalidaPauta && form.fechaFinPauta && form.fechaFinPauta < form.fechaSalidaPauta) {
      notify('La fecha de fin no puede ser anterior a la de salida', 'error'); return;
    }
    setSaving(true);
    try {
      await mediosApi.crearLinea(campaignId, form);
      notify('Línea agregada', 'success');
      onSaved();
    } catch (e: any) {
      notify(e.message || 'No se pudo agregar la línea', 'error');
    } finally {
      setSaving(false);
    }
  };

  const mediosDeCategoria = MEDIA_MAP[form.catMedio as string] || [];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white">Nueva línea táctica</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <select className={inputCls} value={form.catMedio} onChange={e => { const c = e.target.value; setForm(f => ({ ...f, catMedio: c as any, canal: (MEDIA_MAP[c] || [''])[0] })); }}>
                {Object.keys(MEDIA_MAP).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Objetivo">
              <select className={inputCls} value={form.objetivo} onChange={e => set('objetivo', e.target.value)}>
                {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Canal / Medio">
              <select className={inputCls} value={form.canal} onChange={e => set('canal', e.target.value)}>
                {mediosDeCategoria.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Formato">
              <input className={inputCls} value={form.formato || ''} onChange={e => set('formato', e.target.value)} placeholder="Ej. Bumper 6s" />
            </Field>
            <Field label="Audiencia">
              <select className={inputCls} value={form.audiencia} onChange={e => set('audiencia', e.target.value)}>
                {AUDIENCIAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Versión">
              <input className={inputCls} value={form.version || ''} onChange={e => set('version', e.target.value)} placeholder="Ej. Lanzamiento V1" />
            </Field>
            <Field label="Salida pauta">
              <input type="date" className={inputCls} value={form.fechaSalidaPauta || ''} onChange={e => set('fechaSalidaPauta', e.target.value)} />
            </Field>
            <Field label="Fin pauta">
              <input type="date" className={inputCls} value={form.fechaFinPauta || ''} onChange={e => set('fechaFinPauta', e.target.value)} />
            </Field>
          </div>
          <Field label="Aspect ratios">
            <div className="flex gap-2 flex-wrap">
              {RATIOS.map(r => (
                <button key={r} type="button" onClick={() => toggleRatio(r)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${form.ratios?.includes(r) ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  {r}
                </button>
              ))}
            </div>
          </Field>
          <p className="text-[10px] text-slate-400">La nomenclatura y el código UTM se generan automáticamente al guardar.</p>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="gap-1" disabled={saving} onClick={guardar}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Guardar línea
          </Button>
        </div>
      </div>
    </div>
  );
};

const inputCls = 'w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400';
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

export default CampanaDetailPage;
