import React from 'react';
import { Card, CardContent } from '../../../components/ui/Card';

/**
 * Datos que consume el termómetro. `cargadas` y `enQA` son DISJUNTOS (§3.1):
 * cargadas = EN_QA && material subido; enQA = EN_QA && sin material. Suman counts.EN_QA.
 */
export interface TermometroData {
  total: number;
  counts: Record<string, number>;
  cargadas: number;
  enQA: number;
  vencidas?: number;
  enRiesgo?: number;
}

/**
 * Termómetro de 6 estados sin huecos (replica las pills del prototipo):
 * Pendientes, En QA, Cargadas, Rechazadas, Aprobadas/Implementadas, Canceladas.
 * % siempre sobre el total.
 */
const Termometro: React.FC<{ data: TermometroData; titulo?: string }> = ({ data, titulo = '📊 Termómetro de cumplimiento' }) => {
  const total = data.total || 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const c = data.counts || {};

  // Aprobadas + Implementadas agrupadas en una sola pill "Aprobadas/Implementadas".
  const aprobImpl = (c.APROBADO || 0) + (c.IMPLEMENTADO || 0);

  const chips: { label: string; n: number; cls: string; title?: string }[] = [
    { label: 'Pendientes', n: c.PENDIENTE || 0, cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    { label: 'En QA', n: data.enQA || 0, cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', title: 'En QA sin material subido todavía' },
    { label: 'Cargadas', n: data.cargadas || 0, cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', title: 'En QA con material ya subido' },
    { label: 'Rechazadas', n: c.RECHAZADO || 0, cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    { label: 'Aprobadas/Implementadas', n: aprobImpl, cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
    { label: 'Canceladas', n: c.CANCELADO || 0, cls: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</span>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total: {total} pieza(s)</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {chips.map(chip => (
            <span
              key={chip.label}
              title={chip.title}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${chip.cls}`}
            >
              {chip.label}: {chip.n} ({pct(chip.n)}%)
            </span>
          ))}
          {(data.vencidas || 0) > 0 && (
            <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-red-600 text-white animate-pulse">
              ⚠️ Vencidas: {data.vencidas}
            </span>
          )}
          {(data.enRiesgo || 0) > 0 && (
            <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700">
              ⏰ En riesgo (≤48h): {data.enRiesgo}
            </span>
          )}
        </div>
        {/* Barra de progreso: segmentos sin solaparse. */}
        <div className="mt-3 h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex">
          <div className="bg-violet-500" style={{ width: `${pct(aprobImpl)}%` }} />
          <div className="bg-emerald-500" style={{ width: `${pct(data.cargadas || 0)}%` }} />
          <div className="bg-amber-400" style={{ width: `${pct(data.enQA || 0)}%` }} />
          <div className="bg-blue-400" style={{ width: `${pct(c.PENDIENTE || 0)}%` }} />
          <div className="bg-red-400" style={{ width: `${pct(c.RECHAZADO || 0)}%` }} />
          <div className="bg-slate-300 dark:bg-slate-600" style={{ width: `${pct(c.CANCELADO || 0)}%` }} />
        </div>
      </CardContent>
    </Card>
  );
};

export default Termometro;
