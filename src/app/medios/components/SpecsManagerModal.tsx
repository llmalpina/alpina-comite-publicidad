import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi } from '../../../lib/medios-api';
import type { MedioSpec, MedioCategoria } from '../../../types/medios';
import { ModalShell, Field, inputCls } from './ui';

const CATEGORIAS: MedioCategoria[] = ['TTL', 'ATL', 'BTL'];

const emptySpec = (): Partial<MedioSpec> => ({
  catMedio: 'TTL', medio: '', formato: '', ratios: ['16:9'], duracion: '',
  fileTypes: '', audioLufs: '', copyLimits: '', linkSpecs: '', notes: '', maxWeight: '',
});

/**
 * CRUD del catálogo master de specs por categoría TTL/ATL/BTL.
 * Valida https en linkSpecs (si viene). Usa crearSpec/editarSpec/eliminarSpec.
 */
const SpecsManagerModal: React.FC<{
  specs: MedioSpec[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ specs, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<MedioSpec>>(emptySpec());

  const set = (k: keyof MedioSpec, v: any) => setForm(f => ({ ...f, [k]: v }));

  const startNew = () => { setEditId(null); setForm(emptySpec()); };
  const startEdit = (s: MedioSpec) => { setEditId(s.id); setForm({ ...s }); };

  const guardar = async () => {
    if (!form.medio?.trim() || !form.formato?.trim()) { notify('Medio y formato son obligatorios', 'error'); return; }
    if (form.linkSpecs?.trim() && !/^https:\/\/.+/.test(form.linkSpecs.trim())) { notify('El link de specs debe ser https://', 'error'); return; }
    const body: Partial<MedioSpec> = {
      ...form,
      ratios: typeof form.ratios === 'string' ? String(form.ratios).split(',').map(r => r.trim()).filter(Boolean) : form.ratios,
    };
    setSaving(true);
    try {
      if (editId) {
        await mediosApi.editarSpec(editId, body);
        notify('Ficha actualizada', 'success');
      } else {
        await mediosApi.crearSpec(body);
        notify('Ficha creada', 'success');
      }
      startNew();
      onSaved();
    } catch (e: any) {
      notify(e?.message || 'No se pudo guardar la ficha', 'error');
    } finally { setSaving(false); }
  };

  const eliminar = async (s: MedioSpec) => {
    if (!window.confirm(`¿Eliminar la ficha "${s.medio} · ${s.formato}" del catálogo?`)) return;
    setSaving(true);
    try {
      await mediosApi.eliminarSpec(s.id);
      notify('Ficha eliminada', 'success');
      if (editId === s.id) startNew();
      onSaved();
    } catch (e: any) {
      notify(e?.message || 'No se pudo eliminar', 'error');
    } finally { setSaving(false); }
  };

  const ratiosValue = Array.isArray(form.ratios) ? form.ratios.join(', ') : (form.ratios || '');

  return (
    <ModalShell title="📋 Catálogo master de specs" onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Lista por categoría */}
        <div className="space-y-3">
          {CATEGORIAS.map(cat => {
            const catSpecs = specs.filter(s => (s.catMedio || 'TTL') === cat);
            return (
              <div key={cat}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{cat} ({catSpecs.length})</p>
                {catSpecs.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Sin fichas.</p>
                ) : (
                  <div className="space-y-1.5">
                    {catSpecs.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-2 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-1.5">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">{s.medio} · {s.formato}</p>
                          <p className="text-[10px] text-slate-400 truncate">{(s.ratios || []).join(', ')}{s.duracion ? ` · ${s.duracion}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEdit(s)} className="text-slate-400 hover:text-brand" title="Editar"><Pencil size={13} /></button>
                          <button onClick={() => eliminar(s)} className="text-red-500 hover:text-red-700" title="Eliminar"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Formulario alta/edición */}
        <div className="space-y-3 md:border-l md:border-slate-100 md:dark:border-slate-700 md:pl-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{editId ? 'Editar ficha' : 'Nueva ficha'}</p>
            {editId && <Badge variant="secondary" className="text-[9px]">{editId}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Categoría">
              <select className={inputCls} value={form.catMedio} onChange={e => set('catMedio', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Medio">
              <input className={inputCls} value={form.medio || ''} onChange={e => set('medio', e.target.value)} placeholder="Ej. YouTube" />
            </Field>
            <Field label="Formato">
              <input className={inputCls} value={form.formato || ''} onChange={e => set('formato', e.target.value)} placeholder="Ej. Bumper 6s" />
            </Field>
            <Field label="Duración">
              <input className={inputCls} value={form.duracion || ''} onChange={e => set('duracion', e.target.value)} placeholder="Ej. 6s" />
            </Field>
            <Field label="Ratios (coma)">
              <input className={inputCls} value={ratiosValue} onChange={e => set('ratios', e.target.value)} placeholder="16:9, 9:16" />
            </Field>
            <Field label="Peso máx.">
              <input className={inputCls} value={form.maxWeight || ''} onChange={e => set('maxWeight', e.target.value)} placeholder="Ej. 150MB" />
            </Field>
            <Field label="Tipos de archivo">
              <input className={inputCls} value={form.fileTypes || ''} onChange={e => set('fileTypes', e.target.value)} placeholder="MP4, MOV" />
            </Field>
            <Field label="Audio (LUFS)">
              <input className={inputCls} value={form.audioLufs || ''} onChange={e => set('audioLufs', e.target.value)} placeholder="-14 LUFS" />
            </Field>
          </div>
          <Field label="Límites de copy">
            <input className={inputCls} value={form.copyLimits || ''} onChange={e => set('copyLimits', e.target.value)} placeholder="Título: 100 caracteres" />
          </Field>
          <Field label="Link de specs (https)">
            <input className={inputCls} value={form.linkSpecs || ''} onChange={e => set('linkSpecs', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Notas">
            <textarea className={inputCls + ' resize-none'} rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Observaciones de la ficha" />
          </Field>
          <div className="flex justify-between gap-2">
            {editId && <Button variant="ghost" size="sm" onClick={startNew}>Nueva</Button>}
            <Button size="sm" className="gap-1 ml-auto" disabled={saving} onClick={guardar}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {editId ? 'Guardar cambios' : 'Crear ficha'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
        <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
      </div>
    </ModalShell>
  );
};

export default SpecsManagerModal;
