import React, { useMemo, useState } from 'react';
import type { GanttGrouping, MedioLinea } from '../../../types/medios';

type Vista = 'DAY' | 'WEEK' | 'MONTH';

const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MS_DAY = 24 * 60 * 60 * 1000;

const GROUPING_OPTIONS: { value: GanttGrouping; label: string }[] = [
  { value: 'FORMAT', label: '📺 Completo (Medio & Formato)' },
  { value: 'MEDIO', label: '🌐 Medio (unificar formatos)' },
  { value: 'TIPO_MEDIO', label: '📊 Tipo de medio (TTL/ATL/BTL)' },
  { value: 'OBJETIVO', label: '🎯 Objetivo' },
  { value: 'AUDIENCIA', label: '👥 Audiencia' },
];

/** Parse 'YYYY-MM-DD' a Date local a medianoche (solo para posicionamiento visual). */
function parseDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_DAY);
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Gantt / Cronograma táctico multimes. 3 fases por línea: recepción (amber) →
 * montaje (violet) → pauta/aire (emerald). minDate se ancla en la fecha de
 * recepción más temprana (extensión sobre el prototipo, §6.4) para que la barra
 * de recepción quede visible; maxDate = fin de pauta más tardío, redondeado a
 * meses completos. Banner de meses + cabecera de días (finde/festivo resaltados).
 * Selector de agrupación del eje Y y vistas Día/Semana/Mes. Sin librería.
 */
const GanttCronograma: React.FC<{ lineas: MedioLinea[]; festivos: string[] }> = ({ lineas, festivos }) => {
  const [grouping, setGrouping] = useState<GanttGrouping>('FORMAT');
  const [vista, setVista] = useState<Vista>('DAY');

  const festivosSet = useMemo(() => new Set(festivos), [festivos]);

  const conFecha = lineas.filter(l => l.fechaSalidaPauta);

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!conFecha.length) return { minDate: null as Date | null, maxDate: null as Date | null, totalDays: 0 };
    let min: Date | null = null;
    let max: Date | null = null;
    conFecha.forEach(l => {
      // minDate ancla en recepción (o montaje/pauta como fallback).
      const inicio = parseDate(l.fechaRecepcion) || parseDate(l.fechaMontaje) || parseDate(l.fechaSalidaPauta);
      const fin = parseDate(l.fechaFinPauta) || parseDate(l.fechaSalidaPauta);
      if (inicio && (!min || inicio < min)) min = inicio;
      if (fin && (!max || fin > max)) max = fin;
    });
    if (!min || !max) return { minDate: null, maxDate: null, totalDays: 0 };
    // Redondea a meses completos.
    const mi: Date = min;
    const ma: Date = max;
    const mStart = new Date(mi.getFullYear(), mi.getMonth(), 1);
    const mEnd = new Date(ma.getFullYear(), ma.getMonth() + 1, 0);
    return { minDate: mStart, maxDate: mEnd, totalDays: dayDiff(mEnd, mStart) + 1 };
  }, [conFecha]);

  if (!conFecha.length || !minDate || !maxDate) return null;

  const span = Math.max(totalDays, 1);
  const leftPct = (iso?: string | null) => {
    const d = parseDate(iso);
    if (!d) return 0;
    return (dayDiff(d, minDate) / span) * 100;
  };
  const widthPct = (fromIso?: string | null, toIso?: string | null) => {
    const a = parseDate(fromIso), b = parseDate(toIso);
    if (!a || !b) return 0;
    return (Math.max(dayDiff(b, a), 0.4) / span) * 100;
  };

  // Banner de meses.
  const meses: { label: string; days: number }[] = [];
  {
    let cur = new Date(minDate);
    while (cur <= maxDate) {
      const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      meses.push({ label: `${MONTH_NAMES[cur.getMonth()].toUpperCase()} ${cur.getFullYear()}`, days: daysInMonth });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  // Cabecera de días (solo en vista DAY).
  const dias: { iso: string; dow: number; num: number; weekend: boolean; holiday: boolean }[] = [];
  if (vista === 'DAY') {
    let cur = new Date(minDate);
    while (cur <= maxDate) {
      const iso = isoOf(cur);
      const dow = cur.getDay();
      dias.push({ iso, dow, num: cur.getDate(), weekend: dow === 0 || dow === 6, holiday: festivosSet.has(iso) });
      cur = new Date(cur.getTime() + MS_DAY);
    }
  }

  const CELL = 34; // px por día en vista DAY
  const trackWidthPx = vista === 'DAY' ? span * CELL : undefined;

  // Agrupación del eje Y.
  const groupTitle = (l: MedioLinea): { main: string; sub: string } => {
    switch (grouping) {
      case 'MEDIO': return { main: `🌐 ${l.canal}`, sub: `${l.formato} · 🎯 ${l.objetivo}` };
      case 'TIPO_MEDIO': return { main: `📊 ${l.catMedio || 'TTL'}`, sub: `${l.canal} (${l.formato})` };
      case 'OBJETIVO': return { main: `🎯 ${l.objetivo}`, sub: `${l.canal} (${l.formato}) · 👥 ${l.audiencia}` };
      case 'AUDIENCIA': return { main: `👥 ${l.audiencia}`, sub: `🎯 ${l.objetivo} · ${l.canal}` };
      default: return { main: `📺 ${l.canal} · ${l.formato}`, sub: `🎯 ${l.objetivo} · 👥 ${l.audiencia}` };
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Agrupar eje Y</span>
          <select
            value={grouping}
            onChange={e => setGrouping(e.target.value as GanttGrouping)}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-brand focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {GROUPING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
          {(['DAY', 'WEEK', 'MONTH'] as Vista[]).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md transition-colors ${vista === v ? 'bg-white dark:bg-slate-800 text-brand shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {v === 'DAY' ? 'Día' : v === 'WEEK' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Scroll horizontal */}
      <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
        <div style={{ minWidth: vista === 'DAY' ? `${(trackWidthPx || 0) + 180}px` : '640px' }}>
          {/* Banner de meses */}
          <div className="flex border-b border-slate-100 dark:border-slate-700">
            <div className="w-[180px] shrink-0 bg-slate-50 dark:bg-slate-700/40 border-r border-slate-100 dark:border-slate-700" />
            <div className="flex-1 flex">
              {meses.map((m, i) => (
                <div
                  key={i}
                  className="text-[10px] font-bold text-slate-500 dark:text-slate-300 text-center py-1 border-r border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40"
                  style={vista === 'DAY' ? { width: `${m.days * CELL}px` } : { flex: 1 }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Cabecera de días (solo DAY) */}
          {vista === 'DAY' && (
            <div className="flex border-b border-slate-100 dark:border-slate-700">
              <div className="w-[180px] shrink-0 border-r border-slate-100 dark:border-slate-700" />
              <div className="flex">
                {dias.map(d => (
                  <div
                    key={d.iso}
                    title={d.iso}
                    className={`flex flex-col items-center justify-center text-[9px] border-r border-slate-50 dark:border-slate-700/50 ${d.holiday ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : d.weekend ? 'bg-slate-50 dark:bg-slate-700/40 text-slate-400' : 'text-slate-500'}`}
                    style={{ width: `${CELL}px` }}
                  >
                    <span>{DAY_NAMES[d.dow]}</span>
                    <span className="font-bold">{d.num}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filas */}
          {conFecha.map(l => {
            const { main, sub } = groupTitle(l);
            const recLeft = leftPct(l.fechaRecepcion);
            const recWidth = widthPct(l.fechaRecepcion, l.fechaMontaje);
            const monLeft = leftPct(l.fechaMontaje);
            const monWidth = widthPct(l.fechaMontaje, l.fechaSalidaPauta);
            const airLeft = leftPct(l.fechaSalidaPauta);
            const airWidth = widthPct(l.fechaSalidaPauta, l.fechaFinPauta || l.fechaSalidaPauta);
            const hasMaterial = Boolean(l.linkMaterial && l.linkMaterial.trim());
            return (
              <div key={l.lineId} className="flex items-center border-b border-slate-50 dark:border-slate-700/50 last:border-b-0">
                <div className="w-[180px] shrink-0 px-2 py-2 border-r border-slate-100 dark:border-slate-700">
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate" title={main}>{main}</p>
                  <p className="text-[9px] text-slate-400 truncate" title={sub}>{sub}</p>
                </div>
                <div className="flex-1 relative h-9" style={vista === 'DAY' ? { width: `${trackWidthPx}px` } : undefined}>
                  {l.fechaRecepcion && (
                    <div
                      className="absolute top-1.5 h-6 rounded bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center text-[9px] text-white font-bold"
                      style={{ left: `${recLeft}%`, width: `${Math.max(recWidth, 1)}%` }}
                      title={`Recepción: ${l.fechaRecepcion}${hasMaterial ? ' · material cargado' : ''}`}
                    >
                      📥
                    </div>
                  )}
                  {l.fechaMontaje && (
                    <div
                      className="absolute top-1.5 h-6 rounded bg-gradient-to-r from-violet-400 to-violet-600"
                      style={{ left: `${monLeft}%`, width: `${Math.max(monWidth, 1)}%` }}
                      title={`Montaje: ${l.fechaMontaje} → pauta ${l.fechaSalidaPauta}`}
                    />
                  )}
                  <div
                    className="absolute top-1.5 h-6 rounded bg-gradient-to-r from-emerald-400 to-emerald-600"
                    style={{ left: `${airLeft}%`, width: `${Math.max(airWidth, 1)}%` }}
                    title={`Pauta al aire: ${l.fechaSalidaPauta} → ${l.fechaFinPauta || l.fechaSalidaPauta}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-gradient-to-r from-amber-400 to-orange-500 inline-block" /> Recepción</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-gradient-to-r from-violet-400 to-violet-600 inline-block" /> Montaje</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-gradient-to-r from-emerald-400 to-emerald-600 inline-block" /> Pauta al aire</span>
      </div>
    </div>
  );
};

export default GanttCronograma;
