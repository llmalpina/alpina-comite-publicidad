import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useMaestros } from '../../../contexts/MaestrosContext';
import { mediosApi } from '../../../lib/medios-api';
import type { MedioTaxonomia, MedioMarca } from '../../../types/medios';
import { ModalShell, Field, inputCls } from './ui';

const norm = (s: string) => String(s || '').trim().toUpperCase();

/**
 * CRUD de canchas/marcas vía patchTaxonomia (concurrencia optimista por updatedAt).
 * Maneja 409 enUso (entidad con campañas) y 409 de concurrencia (recarga).
 */
const ConfigCanchasModal: React.FC<{
  taxonomia: MedioTaxonomia;
  onClose: () => void;
  onSaved: () => void;
}> = ({ taxonomia, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const { config: maestros } = useMaestros();
  const [saving, setSaving] = useState(false);
  const [nuevaCancha, setNuevaCancha] = useState('');
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [marcaCancha, setMarcaCancha] = useState(taxonomia.canchas[0] || '');

  const canchas = taxonomia.canchas;
  const marcas = taxonomia.marcas;

  // Marcas del maestro de la plataforma (solo activas). Se usan para poblar el
  // dropdown; el nombre visible es el `label` para que cruce con `c.marca` del comité.
  const marcasMaestro = useMemo(
    () => (maestros.marcas || []).filter(m => m.activo !== false).map(m => m.label),
    [maestros.marcas],
  );
  const usarMaestro = marcasMaestro.length > 0;

  const guardar = async (patch: { canchas?: string[]; marcas?: MedioMarca[] }) => {
    setSaving(true);
    try {
      await mediosApi.patchTaxonomia({ ...patch, updatedAt: taxonomia.updatedAt });
      notify('Configuración actualizada', 'success');
      onSaved();
    } catch (e: any) {
      const msg = e?.message || 'No se pudo guardar';
      if (/409|concurren|updatedAt/i.test(msg)) {
        notify('La configuración cambió en otra sesión. Recargando…', 'warning');
        onSaved();
      } else if (/en uso|enUso|vinculad/i.test(msg)) {
        notify(msg, 'error');
      } else {
        notify(msg, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const addCancha = () => {
    const c = norm(nuevaCancha);
    if (!c) { notify('Escribe el nombre de la cancha', 'error'); return; }
    if (canchas.map(norm).includes(c)) { notify('Esa cancha ya existe', 'error'); return; }
    setNuevaCancha('');
    guardar({ canchas: [...canchas, c] });
  };

  const removeCancha = (c: string) => {
    if (!window.confirm(`¿Eliminar la cancha "${c}"? No se puede si tiene campañas vinculadas.`)) return;
    guardar({ canchas: canchas.filter(x => x !== c), marcas: marcas.filter(m => norm(m.cancha) !== norm(c)) });
  };

  const addMarca = () => {
    const nombre = nuevaMarca.trim();
    if (!nombre) { notify('Escribe el nombre de la marca', 'error'); return; }
    if (!marcaCancha) { notify('Selecciona una cancha para la marca', 'error'); return; }
    if (marcas.some(m => m.nombre.trim().toUpperCase() === nombre.toUpperCase() && norm(m.cancha) === norm(marcaCancha))) {
      notify('Esa marca ya existe en esa cancha', 'error'); return;
    }
    setNuevaMarca('');
    guardar({ marcas: [...marcas, { nombre, cancha: norm(marcaCancha) }] });
  };

  const removeMarca = (m: MedioMarca) => {
    if (!window.confirm(`¿Eliminar la marca "${m.nombre}"? No se puede si tiene campañas vinculadas.`)) return;
    guardar({ marcas: marcas.filter(x => !(x.nombre === m.nombre && x.cancha === m.cancha)) });
  };

  return (
    <ModalShell title="⚙️ Configurar canchas y marcas" onClose={onClose} wide>
      {saving && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400"><Loader2 size={12} className="animate-spin" /> Guardando…</div>
      )}

      {/* Canchas */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Canchas</p>
        <div className="flex gap-2 mb-2">
          <input className={inputCls} value={nuevaCancha} onChange={e => setNuevaCancha(e.target.value)} placeholder="Nueva cancha (ej. SNACKING)" />
          <Button size="sm" className="gap-1 shrink-0" disabled={saving} onClick={addCancha}><Plus size={14} /> Agregar</Button>
        </div>
        {canchas.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Sin canchas. Las campañas sin cancha aparecen bajo "SIN ASIGNAR".</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {canchas.map(c => (
              <span key={c} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                {c}
                <button onClick={() => removeCancha(c)} disabled={saving} className="text-red-500 hover:text-red-700" title="Eliminar cancha"><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Marcas */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Marcas</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-2">
          <Field label="Marca">
            {usarMaestro ? (
              <select className={inputCls} value={nuevaMarca} onChange={e => setNuevaMarca(e.target.value)}>
                <option value="">— Selecciona —</option>
                {marcasMaestro.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className={inputCls} value={nuevaMarca} onChange={e => setNuevaMarca(e.target.value)} placeholder="Ej. Bon Yurt" />
            )}
          </Field>
          <Field label="Cancha">
            <select className={inputCls} value={marcaCancha} onChange={e => setMarcaCancha(e.target.value)}>
              <option value="">— Selecciona —</option>
              {canchas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="flex items-end">
            <Button size="sm" className="gap-1 w-full" disabled={saving} onClick={addMarca}><Plus size={14} /> Agregar</Button>
          </div>
        </div>
        {marcas.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Sin marcas configuradas.</p>
        ) : (
          <div className="space-y-1.5">
            {marcas.map((m, i) => (
              <div key={`${m.nombre}-${m.cancha}-${i}`} className="flex items-center justify-between text-[12px] border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-1.5">
                <span className="text-slate-700 dark:text-slate-200"><strong>{m.nombre}</strong> <span className="text-slate-400">· {m.cancha}</span></span>
                <button onClick={() => removeMarca(m)} disabled={saving} className="text-red-500 hover:text-red-700" title="Eliminar marca"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400">No se puede eliminar una cancha o marca con campañas vinculadas (el servidor valida y responde en uso).</p>

      <div className="flex justify-end mt-4">
        <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
      </div>
    </ModalShell>
  );
};

export default ConfigCanchasModal;
