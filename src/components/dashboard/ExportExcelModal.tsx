import React, { useState, useMemo } from 'react';
import { X, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useNotifications } from '../../contexts/NotificationContext';
import { useMaestros } from '../../contexts/MaestrosContext';
import { exportSolicitudesToExcel, filterSolicitudesForExport } from '../../lib/export-excel';
import { STATUS_LABELS } from '../../lib/constants';
import type { Solicitud } from '../../types';

interface ExportExcelModalProps {
  solicitudes: Solicitud[];
  onClose: () => void;
}

/** Modal de exportación a Excel de todas las solicitudes (piezas), con filtro de fecha, marca y estado. */
const ExportExcelModal: React.FC<ExportExcelModalProps> = ({ solicitudes, onClose }) => {
  const { notify } = useNotifications();
  const { config: maestros } = useMaestros();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);

  const brands = useMemo(() => [...new Set(solicitudes.map(s => s.brand).filter(Boolean))].sort(), [solicitudes]);
  const contentTypeLabels = useMemo(() => {
    const map = new Map<string, string>();
    maestros.tiposContenido.forEach(t => map.set(t.value, t.label));
    return map;
  }, [maestros.tiposContenido]);

  const preview = useMemo(
    () => filterSolicitudesForExport(solicitudes, { from: from || null, to: to || null, brand, status }),
    [solicitudes, from, to, brand, status],
  );

  const handleExport = async () => {
    if (preview.length === 0) {
      notify('No hay solicitudes que coincidan con los filtros seleccionados', 'error');
      return;
    }
    setExporting(true);
    try {
      const rangoTexto = from || to ? `_${from || 'inicio'}_a_${to || 'hoy'}` : '';
      await exportSolicitudesToExcel(preview, {
        fileName: `solicitudes_comite${rangoTexto}.xlsx`,
        contentTypeLabels,
      });
      notify(`Excel generado con ${preview.length} solicitud${preview.length === 1 ? '' : 'es'}`, 'success');
      onClose();
    } catch (e: any) {
      notify(e?.message || 'No se pudo generar el Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Exportar a Excel</h3>
              <p className="text-[11px] text-slate-500">Solicitudes del comité de publicidad</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desde</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hasta</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Si dejas las fechas vacías, se exporta el histórico completo.</p>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marca (opcional)</label>
            <select value={brand} onChange={e => setBrand(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm">
              <option value="">Todas las marcas</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado (opcional)</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm">
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">
            Se exportarán <strong className="text-slate-900 dark:text-white">{preview.length}</strong> solicitud{preview.length === 1 ? '' : 'es'} con los filtros actuales.
          </div>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={exporting}>Cancelar</Button>
          <Button className="flex-1 gap-2" onClick={handleExport} disabled={exporting || preview.length === 0}>
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Generando...' : 'Descargar Excel'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExportExcelModal;
