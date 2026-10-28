import React, { useState } from 'react';
import { Link2Off, Loader2, Plus } from 'lucide-react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { mediosApi } from '../../../lib/medios-api';
import type { MedioPieza, MedioLinea } from '../../../types/medios';
import MultimarcaBadge from './MultimarcaBadge';

/**
 * Panel de piezas atadas a la campaña. Por cada pieza: consecutivo, título,
 * marca única, nº de líneas, y acciones "Agregar línea" / "Desatar" (cascada).
 * Gateado por medios_iniciar_campana (puedeGestionarPiezas).
 */
const PiezasPanel: React.FC<{
  campaignId: string;
  piezas: MedioPieza[];
  lineas: MedioLinea[];
  puedeGestionarPiezas?: boolean;
  onAgregarLinea: (pieza: MedioPieza) => void;
  onChanged: () => void;
}> = ({ campaignId, piezas, lineas, puedeGestionarPiezas = true, onAgregarLinea, onChanged }) => {
  const { notify } = useNotifications();
  const [desatando, setDesatando] = useState<string | null>(null);

  const lineasDe = (solicitudId: string) => lineas.filter(l => l.solicitudId === solicitudId).length;

  const desatar = async (p: MedioPieza) => {
    const n = lineasDe(p.solicitudId);
    if (!window.confirm(
      `¿Desatar la pieza "${p.consecutive}"? Se eliminarán ${n} línea(s) y los archivos de esta pieza. No se puede deshacer.`,
    )) return;
    setDesatando(p.solicitudId);
    try {
      const res = await mediosApi.desatarPieza(campaignId, p.solicitudId);
      notify(`Pieza desatada (${res.lineasEliminadas} línea(s), ${res.assetsEliminados} archivo(s) eliminados)`, 'success');
      onChanged();
    } catch (e: any) {
      notify(e.message || 'No se pudo desatar la pieza', 'error');
    } finally {
      setDesatando(null);
    }
  };

  if (piezas.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        Aún no hay piezas atadas. Usa "Agregar piezas" para buscar y atar solicitudes publicadas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-700">
            <th className="py-2 px-2">Consecutivo</th>
            <th className="py-2 px-2">Título</th>
            <th className="py-2 px-2">Marca</th>
            <th className="py-2 px-2 w-20">Líneas</th>
            {puedeGestionarPiezas && <th className="py-2 px-2 w-56">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {piezas.map(p => (
            <tr key={p.solicitudId} className="border-b border-slate-50 dark:border-slate-700/50 align-top">
              <td className="py-2 px-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">{p.consecutive}</td>
              <td className="py-2 px-2 text-[12px] text-slate-700 dark:text-slate-200">{p.title}</td>
              <td className="py-2 px-2"><MultimarcaBadge marcas={p.marcas} /></td>
              <td className="py-2 px-2 text-[12px] text-slate-500">{lineasDe(p.solicitudId)}</td>
              {puedeGestionarPiezas && (
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => onAgregarLinea(p)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-brand/10 text-brand hover:bg-brand/20"
                      title="Agregar línea a esta pieza"
                    >
                      <Plus size={11} /> Agregar línea
                    </button>
                    <button
                      onClick={() => desatar(p)}
                      disabled={desatando === p.solicitudId}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Desatar pieza (borra sus líneas y archivos)"
                    >
                      {desatando === p.solicitudId ? <Loader2 size={11} className="animate-spin" /> : <Link2Off size={11} />} Desatar
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PiezasPanel;
