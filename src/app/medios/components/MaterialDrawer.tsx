import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi } from '../../../lib/medios-api';
import type { MedioLinea } from '../../../types/medios';
import { Drawer, Field, inputCls } from './ui';

/**
 * Drawer de gestión de material. Carga link del material + URL destino (el backend
 * pasa la línea a EN_QA). Nomenclatura y UTM son READ-ONLY del backend (precisión 6):
 * la URL final para copiar es urlDestino + (?|&) + utmAuto EXACTO; no se recrea buildUTM.
 */
const MaterialDrawer: React.FC<{
  campaignId: string;
  linea: MedioLinea;
  onClose: () => void;
  onSaved: () => void;
}> = ({ campaignId, linea, onClose, onSaved }) => {
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [linkMaterial, setLinkMaterial] = useState(linea.linkMaterial || '');
  const [urlDestino, setUrlDestino] = useState(linea.urlDestino || '');
  const [copied, setCopied] = useState<string | null>(null);

  const guardar = async () => {
    if (!/^https:\/\/.+/.test(linkMaterial.trim())) { notify('El link del material debe ser https://', 'error'); return; }
    if (urlDestino.trim() && !/^https:\/\/.+/.test(urlDestino.trim())) { notify('La URL de destino debe ser https://', 'error'); return; }
    setSaving(true);
    try {
      await mediosApi.cargarMaterial(campaignId, linea.lineId, {
        linkMaterial: linkMaterial.trim(),
        urlDestino: urlDestino.trim() || undefined,
      });
      notify('Material cargado. La línea pasó a En QA.', 'success');
      onSaved();
    } catch (e: any) {
      notify(e.message || 'No se pudo cargar el material', 'error');
    } finally { setSaving(false); }
  };

  // URL final = urlDestino + separador + utmAuto (concatenación solo para copiar).
  const urlConUtm = (() => {
    const base = (urlDestino || linea.urlDestino || '').trim();
    const utm = (linea.utmAuto || '').trim();
    if (!base || !utm) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${utm}`;
  })();

  const copiar = async (texto: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(tag);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      notify('No se pudo copiar', 'error');
    }
  };

  return (
    <Drawer title={`Gestión de material · ${linea.canal} ${linea.formato}`} onClose={onClose}>
      <Field label="Link del material (agencia)">
        <input className={inputCls} value={linkMaterial} onChange={e => setLinkMaterial(e.target.value)} placeholder="https://drive.google.com/file/..." />
      </Field>
      <Field label="URL de destino de pauta (opcional)">
        <input className={inputCls} value={urlDestino} onChange={e => setUrlDestino(e.target.value)} placeholder="https://www.alpina.com/..." />
      </Field>
      <p className="text-[10px] text-slate-400">Al guardar, la línea pasa automáticamente a <strong>En QA</strong>.</p>
      <Button size="sm" className="gap-1 w-full" disabled={saving} onClick={guardar}><Save size={14} /> Guardar material</Button>

      {/* Nomenclatura / UTM read-only del backend */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
        <ReadOnlyRow label="Nomenclatura (servidor)" value={linea.nomenclaturaAuto || '—'} copied={copied === 'nom'} onCopy={() => linea.nomenclaturaAuto && copiar(linea.nomenclaturaAuto, 'nom')} />
        <ReadOnlyRow label="UTM (servidor)" value={linea.utmAuto || '—'} copied={copied === 'utm'} onCopy={() => linea.utmAuto && copiar(linea.utmAuto, 'utm')} />
        {urlConUtm && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">URL final con UTM</p>
            <div className="mt-1 flex items-start gap-2">
              <code className="flex-1 text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1.5 rounded break-all">{urlConUtm}</code>
              <button onClick={() => copiar(urlConUtm, 'url')} className="shrink-0 text-slate-400 hover:text-brand mt-1" title="Copiar URL con UTM">
                {copied === 'url' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
              <a href={urlConUtm} target="_blank" rel="noreferrer" className="shrink-0 text-slate-400 hover:text-brand mt-1" title="Abrir"><ExternalLink size={14} /></a>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

const ReadOnlyRow: React.FC<{ label: string; value: string; copied: boolean; onCopy: () => void }> = ({ label, value, copied, onCopy }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <div className="mt-1 flex items-start gap-2">
      <code className="flex-1 text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1.5 rounded break-all">{value}</code>
      <button onClick={onCopy} className="shrink-0 text-slate-400 hover:text-brand mt-1" title="Copiar">
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </button>
    </div>
  </div>
);

export default MaterialDrawer;
