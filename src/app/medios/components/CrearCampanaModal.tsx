import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi } from '../../../lib/medios-api';
import type { MedioTaxonomia } from '../../../types/medios';
import { ModalShell, Field, ModalActions, inputCls } from './ui';

/**
 * Crea una campaña VACÍA (flujo V2). Nombre requerido, cancha de la taxonomía
 * (config), tier opcional. Al guardar navega al detalle para atar piezas.
 * Gateado por medios_iniciar_campana en el llamador.
 */
const CrearCampanaModal: React.FC<{
  taxonomia: MedioTaxonomia;
  onClose: () => void;
  onConfigCanchas?: () => void;
}> = ({ taxonomia, onClose, onConfigCanchas }) => {
  const { notify } = useNotifications();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const canchas = taxonomia.canchas || [];
  const [campanaNombre, setCampanaNombre] = useState('');
  const [cancha, setCancha] = useState(canchas[0] || '');
  const [tier, setTier] = useState<'' | 'T1' | 'T2' | 'T3'>('');

  const guardar = async () => {
    if (!campanaNombre.trim()) { notify('El nombre de la campaña es obligatorio', 'error'); return; }
    if (!cancha) { notify('Selecciona una cancha', 'error'); return; }
    setSaving(true);
    try {
      const meta = await mediosApi.crearCampana({
        campanaNombre: campanaNombre.trim(),
        cancha,
        ...(tier ? { tier } : {}),
      });
      notify(`Campaña "${campanaNombre.trim()}" creada`, 'success');
      navigate(`/medios/campanas/${meta.campaignId}`);
    } catch (e: any) {
      notify(e.message || 'No se pudo crear la campaña', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="🎬 Nueva campaña" onClose={onClose}>
      {canchas.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          <p>Configura al menos una cancha antes de crear campañas.</p>
          {onConfigCanchas && (
            <button
              onClick={() => { onClose(); onConfigCanchas(); }}
              className="text-brand underline mt-2"
            >
              Configurar canchas
            </button>
          )}
        </div>
      ) : (
        <>
          <Field label="Nombre de campaña">
            <input
              className={inputCls}
              value={campanaNombre}
              onChange={e => setCampanaNombre(e.target.value)}
              placeholder="Ej. Lanzamiento Lonchera Verano"
              autoFocus
            />
          </Field>
          <Field label="Cancha">
            <select className={inputCls} value={cancha} onChange={e => setCancha(e.target.value)}>
              {canchas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Tier (opcional)">
            <select className={inputCls} value={tier} onChange={e => setTier(e.target.value as any)}>
              <option value="">— Sin tier —</option>
              <option value="T1">T1</option>
              <option value="T2">T2</option>
              <option value="T3">T3</option>
            </select>
          </Field>
          <ModalActions saving={saving} onClose={onClose} onSave={guardar} label="Crear campaña" icon={<Save size={14} />} />
        </>
      )}
    </ModalShell>
  );
};

export default CrearCampanaModal;
