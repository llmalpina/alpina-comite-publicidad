import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

/** Clase estándar de input del módulo (estilo app, dark mode, foco brand). */
export const inputCls =
  'w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';

/** Campo con etiqueta pequeña en mayúsculas. */
export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

/** Overlay + panel de modal centrado. */
export const ModalShell: React.FC<{
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl p-5 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  </div>
);

/** Fila de acciones Cancelar / Guardar. */
export const ModalActions: React.FC<{
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
  label: string;
  icon?: React.ReactNode;
}> = ({ saving, onClose, onSave, label, icon }) => (
  <div className="flex justify-end gap-2 mt-5">
    <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
    <Button size="sm" disabled={saving} onClick={onSave} className="gap-1">
      {saving ? <Loader2 size={14} className="animate-spin" /> : icon} {label}
    </Button>
  </div>
);

/** Panel lateral (drawer) deslizante desde la derecha. */
export const Drawer: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50" onClick={onClose}>
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
    <div
      className="absolute right-0 top-0 h-full w-[480px] max-w-full bg-white dark:bg-slate-800 shadow-2xl overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  </div>
);
