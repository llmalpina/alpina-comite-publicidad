import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, Film, History, Hash, Link2, X, Upload, CheckCircle2, XCircle, Play, Trash2, Layers } from 'lucide-react';
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
  const [materialLinea, setMaterialLinea] = useState<MedioLinea | null>(null);
  const [aprobarLinea, setAprobarLinea] = useState<MedioLinea | null>(null);

  const [masivaOpen, setMasivaOpen] = useState(false);

  const cambiarEstado = async (l: MedioLinea, estado: string) => {
    if (!id) return;
    const nota = estado === 'RECHAZADO' ? (window.prompt('Motivo del rechazo (opcional):') ?? '') : '';
    try {
      await mediosApi.cambiarEstado(id, l.lineId, estado, { nota });
      notify('Estado actualizado', 'success');
      await cargar();
    } catch (e: any) {
      notify(e.message || 'No se pudo cambiar el estado', 'error');
    }
  };

  const eliminarLinea = async (l: MedioLinea) => {
    if (!id) return;
    if (!window.confirm(`¿Eliminar la línea ${l.canal} · ${l.formato}?`)) return;
    try {
      await mediosApi.eliminarLinea(id, l.lineId);
      notify('Línea eliminada', 'success');
      await cargar();
    } catch (e: any) {
      notify(e.message || 'No se pudo eliminar', 'error');
    }
  };

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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setMasivaOpen(true)}><Layers size={14} /> Carga masiva</Button>
              <Button size="sm" className="gap-1" onClick={() => setModalOpen(true)}><Plus size={14} /> Agregar línea</Button>
            </div>
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
                    {(l.fechaRecepcion || l.fechaMontaje) && (
                      <p className="text-[10px] mt-0.5 flex gap-2 flex-wrap">
                        <span className="text-orange-600">📥 Recepción: {l.fechaRecepcion || '—'}</span>
                        <span className="text-purple-600">🛠️ Montaje: {l.fechaMontaje || '—'}</span>
                        <span className="text-slate-400">(SLA días hábiles)</span>
                      </p>
                    )}
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-slate-500 flex items-center gap-1"><Hash size={11} className="shrink-0" /> <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{l.nomenclaturaAuto}</code></p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1"><Link2 size={11} className="shrink-0" /> <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded break-all">{l.utmAuto}</code></p>
                      {l.linkMaterial && <p className="text-[10px] text-slate-500 flex items-center gap-1"><Film size={11} className="shrink-0" /> Material: <a href={l.linkMaterial} target="_blank" rel="noreferrer" className="text-violet-600 underline break-all">{l.linkMaterial}</a></p>}
                      {l.urlDefinitiva && <p className="text-[10px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={11} className="shrink-0" /> URL definitiva: <a href={l.urlDefinitiva} target="_blank" rel="noreferrer" className="underline break-all">{l.urlDefinitiva}</a></p>}
                    </div>
                    {/* Acciones según estado (fase ADMIN: el admin ejecuta todas las transiciones) */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {(l.estadoQA === 'PENDIENTE' || l.estadoQA === 'RECHAZADO') && (
                        <Button size="sm" variant="outline" className="gap-1 text-[11px] h-7" onClick={() => setMaterialLinea(l)}><Upload size={12} /> Cargar material</Button>
                      )}
                      {l.estadoQA === 'EN_QA' && (
                        <>
                          <Button size="sm" className="gap-1 text-[11px] h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => setAprobarLinea(l)}><CheckCircle2 size={12} /> Aprobar QA</Button>
                          <Button size="sm" variant="outline" className="gap-1 text-[11px] h-7 text-red-600 border-red-200" onClick={() => cambiarEstado(l, 'RECHAZADO')}><XCircle size={12} /> Rechazar</Button>
                        </>
                      )}
                      {l.estadoQA === 'APROBADO' && (
                        <Button size="sm" className="gap-1 text-[11px] h-7 bg-violet-600 hover:bg-violet-700" onClick={() => cambiarEstado(l, 'IMPLEMENTADO')}><Play size={12} /> Marcar implementado</Button>
                      )}
                      <button onClick={() => eliminarLinea(l)} className="text-[11px] text-red-500 hover:text-red-700 ml-auto flex items-center gap-1" title="Eliminar línea">
                        <Trash2 size={12} /> Eliminar
                      </button>
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

      {/* Gantt simple de fechas (recepción → montaje → pauta) */}
      {lineas.some(l => l.fechaSalidaPauta) && <GanttFechas lineas={lineas} />}

      {modalOpen && <NuevaLineaModal campaignId={meta.campaignId} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); cargar(); }} />}
      {masivaOpen && <CargaMasivaModal campaignId={meta.campaignId} onClose={() => setMasivaOpen(false)} onSaved={() => { setMasivaOpen(false); cargar(); }} />}
      {materialLinea && <MaterialModal campaignId={meta.campaignId} linea={materialLinea} onClose={() => setMaterialLinea(null)} onSaved={() => { setMaterialLinea(null); cargar(); }} />}
      {aprobarLinea && <AprobarModal campaignId={meta.campaignId} linea={aprobarLinea} onClose={() => setAprobarLinea(null)} onSaved={() => { setAprobarLinea(null); cargar(); }} />}
    </div>
  );
};

// ─── Modal cargar material ─────────────────────────────────────────────────────

const MaterialModal: React.FC<{ campaignId: string; linea: MedioLinea; onClose: () => void; onSaved: () => void }> = ({ campaignId, linea, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [linkMaterial, setLinkMaterial] = useState('');
  const [urlDestino, setUrlDestino] = useState('');

  const guardar = async () => {
    if (!/^https:\/\/.+/.test(linkMaterial.trim())) { notify('El link del material debe ser https://', 'error'); return; }
    setSaving(true);
    try {
      await mediosApi.cargarMaterial(campaignId, linea.lineId, { linkMaterial: linkMaterial.trim(), urlDestino: urlDestino.trim() || undefined });
      notify('Material cargado. La línea pasó a QA.', 'success');
      onSaved();
    } catch (e: any) {
      notify(e.message || 'No se pudo cargar el material', 'error');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Cargar material · ${linea.canal} ${linea.formato}`} onClose={onClose}>
      <Field label="Link del material (agencia)">
        <input className={inputCls} value={linkMaterial} onChange={e => setLinkMaterial(e.target.value)} placeholder="https://drive.google.com/file/..." />
      </Field>
      <Field label="URL de destino de pauta (opcional)">
        <input className={inputCls} value={urlDestino} onChange={e => setUrlDestino(e.target.value)} placeholder="https://www.alpina.com/..." />
      </Field>
      <p className="text-[10px] text-slate-400">Al guardar, la línea pasa automáticamente a <strong>En QA</strong>.</p>
      <ModalActions saving={saving} onClose={onClose} onSave={guardar} label="Guardar material" />
    </ModalShell>
  );
};

// ─── Modal aprobar QA (exige URL definitiva) ───────────────────────────────────

const AprobarModal: React.FC<{ campaignId: string; linea: MedioLinea; onClose: () => void; onSaved: () => void }> = ({ campaignId, linea, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [urlDefinitiva, setUrlDefinitiva] = useState('');

  const aprobar = async () => {
    if (!/^https:\/\/.+/.test(urlDefinitiva.trim())) { notify('La URL definitiva debe ser https://', 'error'); return; }
    setSaving(true);
    try {
      await mediosApi.cambiarEstado(campaignId, linea.lineId, 'APROBADO', { urlDefinitiva: urlDefinitiva.trim() });
      notify('Línea aprobada', 'success');
      onSaved();
    } catch (e: any) {
      notify(e.message || 'No se pudo aprobar', 'error');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Aprobar QA · ${linea.canal} ${linea.formato}`} onClose={onClose}>
      <Field label="URL definitiva del material (CDN público)">
        <input className={inputCls} value={urlDefinitiva} onChange={e => setUrlDefinitiva(e.target.value)} placeholder="https://cdn.alpina.com/media/..." />
      </Field>
      <p className="text-[10px] text-slate-400">La aprobación libera la pieza para pauta e inyecta la URL definitiva.</p>
      <ModalActions saving={saving} onClose={onClose} onSave={aprobar} label="Aprobar" />
    </ModalShell>
  );
};

// ─── Shells reutilizables de modal ─────────────────────────────────────────────

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  </div>
);

const ModalActions: React.FC<{ saving: boolean; onClose: () => void; onSave: () => void; label: string }> = ({ saving, onClose, onSave, label }) => (
  <div className="flex justify-end gap-2 mt-5">
    <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
    <Button size="sm" disabled={saving} onClick={onSave} className="gap-1">
      {saving ? <Loader2 size={14} className="animate-spin" /> : null} {label}
    </Button>
  </div>
);

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

// ─── Gantt simple de fechas ────────────────────────────────────────────────────

const GanttFechas: React.FC<{ lineas: MedioLinea[] }> = ({ lineas }) => {
  const conFecha = lineas.filter(l => l.fechaSalidaPauta);
  if (!conFecha.length) return null;
  // Rango temporal: de la fecha de recepción más temprana a la de fin de pauta más tardía.
  const fechas: number[] = [];
  conFecha.forEach(l => {
    [l.fechaRecepcion, l.fechaMontaje, l.fechaSalidaPauta, l.fechaFinPauta].forEach(f => { if (f) fechas.push(Date.parse(f)); });
  });
  const min = Math.min(...fechas), max = Math.max(...fechas);
  const span = Math.max(max - min, 1);
  const pos = (f?: string) => (f ? ((Date.parse(f) - min) / span) * 100 : 0);

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Cronograma</h2>
        <div className="space-y-3">
          {conFecha.map(l => {
            const r = pos(l.fechaRecepcion), m = pos(l.fechaMontaje), s = pos(l.fechaSalidaPauta), f = pos(l.fechaFinPauta || l.fechaSalidaPauta);
            return (
              <div key={l.lineId}>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{l.canal} · {l.formato}</p>
                <div className="relative h-6 bg-slate-100 dark:bg-slate-700 rounded">
                  {/* Barra de pauta (verde) */}
                  <div className="absolute h-6 bg-emerald-400/70 rounded" style={{ left: `${s}%`, width: `${Math.max(f - s, 2)}%` }} title={`Pauta ${l.fechaSalidaPauta} → ${l.fechaFinPauta}`} />
                  {/* Hitos recepción (naranja) y montaje (morado) */}
                  {l.fechaRecepcion && <div className="absolute w-2 h-6 bg-orange-500 rounded-sm" style={{ left: `${r}%` }} title={`Recepción ${l.fechaRecepcion}`} />}
                  {l.fechaMontaje && <div className="absolute w-2 h-6 bg-purple-500 rounded-sm" style={{ left: `${m}%` }} title={`Montaje ${l.fechaMontaje}`} />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-sm inline-block" /> Recepción</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500 rounded-sm inline-block" /> Montaje</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-sm inline-block" /> Pauta al aire</span>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Modal de carga masiva (objetivos × audiencias) ─────────────────────────────

const CargaMasivaModal: React.FC<{ campaignId: string; onClose: () => void; onSaved: () => void }> = ({ campaignId, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [catMedio, setCatMedio] = useState('TTL');
  const [canal, setCanal] = useState(MEDIA_MAP.TTL[0]);
  const [formato, setFormato] = useState('');
  const [objetivos, setObjetivos] = useState<string[]>(['Awareness']);
  const [audiencias, setAudiencias] = useState<string[]>([AUDIENCIAS[0]]);
  const [fechaSalidaPauta, setFechaSalidaPauta] = useState('');
  const [fechaFinPauta, setFechaFinPauta] = useState('');

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const totalLineas = objetivos.length * audiencias.length;

  const guardar = async () => {
    if (!canal || !formato) { notify('Canal y formato son obligatorios', 'error'); return; }
    if (totalLineas === 0) { notify('Selecciona al menos un objetivo y una audiencia', 'error'); return; }
    setSaving(true);
    try {
      // Genera una línea por cada combinación objetivo × audiencia.
      for (const objetivo of objetivos) {
        for (const audiencia of audiencias) {
          await mediosApi.crearLinea(campaignId, {
            catMedio: catMedio as any, canal, formato, objetivo: objetivo as any, audiencia,
            ratios: ['16:9', '9:16', '1:1', '4:5'], cantidadPiezas: 1, fechaSalidaPauta, fechaFinPauta,
          });
        }
      }
      notify(`${totalLineas} líneas creadas`, 'success');
      onSaved();
    } catch (e: any) {
      notify(e.message || 'Error en carga masiva', 'error');
    } finally { setSaving(false); }
  };

  const mediosDeCategoria = MEDIA_MAP[catMedio] || [];

  return (
    <ModalShell title="Carga masiva por objetivos × audiencias" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría">
          <select className={inputCls} value={catMedio} onChange={e => { setCatMedio(e.target.value); setCanal((MEDIA_MAP[e.target.value] || [''])[0]); }}>
            {Object.keys(MEDIA_MAP).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Canal / Medio">
          <select className={inputCls} value={canal} onChange={e => setCanal(e.target.value)}>
            {mediosDeCategoria.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Formato">
          <input className={inputCls} value={formato} onChange={e => setFormato(e.target.value)} placeholder="Ej. Reels Video" />
        </Field>
        <Field label="Salida pauta">
          <input type="date" className={inputCls} value={fechaSalidaPauta} onChange={e => setFechaSalidaPauta(e.target.value)} />
        </Field>
      </div>
      <Field label={`Objetivos (${objetivos.length})`}>
        <div className="flex gap-2 flex-wrap">
          {OBJETIVOS.map(o => (
            <button key={o} type="button" onClick={() => toggle(objetivos, setObjetivos, o)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${objetivos.includes(o) ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{o}</button>
          ))}
        </div>
      </Field>
      <Field label={`Audiencias (${audiencias.length})`}>
        <div className="flex gap-2 flex-wrap">
          {AUDIENCIAS.map(a => (
            <button key={a} type="button" onClick={() => toggle(audiencias, setAudiencias, a)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${audiencias.includes(a) ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{a}</button>
          ))}
        </div>
      </Field>
      <p className="text-[11px] font-bold text-violet-600">Se crearán {totalLineas} línea(s) · ratios: todos por defecto</p>
      <ModalActions saving={saving} onClose={onClose} onSave={guardar} label={`Crear ${totalLineas} líneas`} />
    </ModalShell>
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
