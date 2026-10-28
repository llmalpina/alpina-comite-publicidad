import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Search } from 'lucide-react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi, type MedioDisponible } from '../../../lib/medios-api';
import { ModalShell, Field, ModalActions, inputCls } from './ui';

/**
 * Buscador de piezas (solicitudes publicadas y libres) para atar a una campaña.
 * Filtra EN MEMORIA por texto (título), consecutivo/número y marca. Selección
 * múltiple; reporta las piezas omitidas (p.ej. ya atadas a otra campaña).
 */
const BuscadorPiezasModal: React.FC<{
  campaignId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ campaignId, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disponibles, setDisponibles] = useState<MedioDisponible[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const [qTexto, setQTexto] = useState('');
  const [qConsec, setQConsec] = useState('');
  const [qMarca, setQMarca] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setDisponibles(await mediosApi.disponibles());
      } catch (e: any) {
        notify(e.message || 'No se pudieron cargar las piezas disponibles', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtradas = useMemo(() => {
    const t = qTexto.trim().toLowerCase();
    const c = qConsec.trim().toLowerCase();
    const m = qMarca.trim().toLowerCase();
    return disponibles.filter(d => {
      if (t && !(d.title || '').toLowerCase().includes(t)) return false;
      if (c && !(d.consecutive || '').toLowerCase().includes(c)) return false;
      if (m) {
        const marcas = (d.marcas && d.marcas.length ? d.marcas : [d.marca]).map(x => (x || '').toLowerCase());
        if (!marcas.some(x => x.includes(m))) return false;
      }
      return true;
    });
  }, [disponibles, qTexto, qConsec, qMarca]);

  const toggle = (id: string) =>
    setSel(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const atar = async () => {
    const ids = Array.from(sel);
    if (ids.length === 0) { notify('Selecciona al menos una pieza', 'error'); return; }
    setSaving(true);
    try {
      const res = await mediosApi.atarPiezas(campaignId, ids);
      const n = res.atadas.length;
      if (res.omitidas.length > 0) {
        const detalle = res.omitidas.map(o => o.motivo);
        const yaOtra = detalle.filter(d => /otra campaña/i.test(d)).length;
        const extra = yaOtra > 0 ? `, ${yaOtra} ya pertenecía(n) a otra campaña` : `, ${res.omitidas.length} omitida(s)`;
        notify(`${n} pieza(s) atada(s)${extra}`, n > 0 ? 'warning' : 'error');
      } else {
        notify(`${n} pieza(s) atada(s)`, 'success');
      }
      onSaved();
    } catch (e: any) {
      notify(e.message || 'No se pudieron atar las piezas', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="➕ Agregar piezas a la campaña" onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Field label="Buscar por título">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputCls} pl-8`} value={qTexto} onChange={e => setQTexto(e.target.value)} placeholder="Título…" />
          </div>
        </Field>
        <Field label="Consecutivo / nº">
          <input className={inputCls} value={qConsec} onChange={e => setQConsec(e.target.value)} placeholder="Ej. MKT-123" />
        </Field>
        <Field label="Marca">
          <input className={inputCls} value={qMarca} onChange={e => setQMarca(e.target.value)} placeholder="Marca…" />
        </Field>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="animate-spin mr-2" size={18} /> Cargando piezas…</div>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No hay piezas disponibles con esos filtros.</p>
      ) : (
        <div className="max-h-[48vh] overflow-y-auto space-y-1.5">
          {filtradas.map(d => {
            const marcaTxt = (d.marcas && d.marcas.length ? d.marcas : [d.marca]).filter(Boolean).join(', ') || 'Sin marca';
            const checked = sel.has(d.solicitudId);
            return (
              <label
                key={d.solicitudId}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  checked ? 'border-brand/50 bg-brand/5' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <input type="checkbox" className="mt-1 accent-brand" checked={checked} onChange={() => toggle(d.solicitudId)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{d.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {d.consecutive} · {marcaTxt}{d.producto ? ` · ${d.producto}` : ''} · {d.numeroPiezas || 0} pieza(s)
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <ModalActions
        saving={saving}
        onClose={onClose}
        onSave={atar}
        label={`Atar ${sel.size} pieza(s)`}
        icon={<Link2 size={14} />}
      />
    </ModalShell>
  );
};

export default BuscadorPiezasModal;
