import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { MedioLinea, MedioSpec } from '../../../types/medios';
import { Drawer } from './ui';

/**
 * Drawer de ficha técnica (specs) de una línea. Busca la spec por medio+formato
 * en el catálogo; si falta un campo (p.ej. maxWeight) muestra "No especificado".
 */
const SpecsDrawer: React.FC<{
  linea: MedioLinea;
  specs: MedioSpec[];
  onClose: () => void;
}> = ({ linea, specs, onClose }) => {
  const spec = specs.find(s => s.medio === linea.canal && s.formato === linea.formato);

  const na = (v?: string | string[]) => {
    if (Array.isArray(v)) return v.length ? v.join(', ') : 'No especificado';
    return v && String(v).trim() ? v : 'No especificado';
  };

  const rows: { label: string; value: string }[] = spec
    ? [
        { label: 'Categoría', value: spec.catMedio },
        { label: 'Ratios', value: na(spec.ratios) },
        { label: 'Duración', value: na(spec.duracion) },
        { label: 'Tipos de archivo', value: na(spec.fileTypes) },
        { label: 'Peso máximo', value: na(spec.maxWeight) },
        { label: 'Audio (LUFS)', value: na(spec.audioLufs) },
        { label: 'Límites de copy', value: na(spec.copyLimits) },
      ]
    : [];

  return (
    <Drawer title={`📋 Specs · ${linea.canal} ${linea.formato}`} onClose={onClose}>
      {!spec ? (
        <p className="text-[12px] text-slate-500">No hay una ficha técnica registrada para <strong>{linea.canal} · {linea.formato}</strong> en el catálogo master.</p>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.label} className="flex items-start justify-between gap-3 text-[12px] border-b border-slate-50 dark:border-slate-700/50 pb-1.5">
                <span className="text-slate-400 font-semibold uppercase tracking-wide text-[10px] pt-0.5">{r.label}</span>
                <span className="text-slate-700 dark:text-slate-200 text-right">{r.value}</span>
              </div>
            ))}
          </div>
          {spec.notes && (
            <div className="mt-3 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
              <p className="font-bold uppercase tracking-wide text-[9px] text-slate-400 mb-1">Notas</p>
              {spec.notes}
            </div>
          )}
          {spec.linkSpecs && (
            <a href={spec.linkSpecs} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
              <ExternalLink size={12} /> Documentación oficial
            </a>
          )}
        </>
      )}
    </Drawer>
  );
};

export default SpecsDrawer;
