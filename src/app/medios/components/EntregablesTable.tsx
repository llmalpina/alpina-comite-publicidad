import React from 'react';
import { Pencil, FileText, Upload, Link2 } from 'lucide-react';
import { MEDIO_ESTADO_LABELS, type MedioLinea, type MedioSpec } from '../../../types/medios';

/**
 * Tabla de entregables agrupada por Objetivo/Audiencia. Columnas: Editar,
 * Medio+Formato+Ratios, Specs, Recepción, Montaje, Inicio Pauta, Estado QA,
 * Gestión de Material. Pills de fecha amber (recepción) / violet (montaje) /
 * emerald (pauta). Scroll horizontal en pantallas medianas.
 */
const EntregablesTable: React.FC<{
  lineas: MedioLinea[];
  specs: MedioSpec[];
  /** Permite editar línea y cargar/editar material (ocultamiento de UX; el backend es la barrera real). */
  puedeGestionarLineas?: boolean;
  /** Permite abrir el modal de estado/QA para cambiar estados. Si es false, el estado se muestra como badge de solo lectura. */
  puedeQA?: boolean;
  onEditar: (l: MedioLinea) => void;
  onSpecs: (l: MedioLinea) => void;
  onMaterial: (l: MedioLinea) => void;
  onEstado: (l: MedioLinea) => void;
}> = ({ lineas, specs, puedeGestionarLineas = true, puedeQA = true, onEditar, onSpecs, onMaterial, onEstado }) => {
  // Agrupa por objetivo___audiencia.
  const grupos = new Map<string, { objetivo: string; audiencia: string; items: MedioLinea[] }>();
  lineas.forEach(l => {
    const objetivo = l.objetivo || 'General';
    const audiencia = l.audiencia || 'General';
    const key = `${objetivo}___${audiencia}`;
    if (!grupos.has(key)) grupos.set(key, { objetivo, audiencia, items: [] });
    grupos.get(key)!.items.push(l);
  });

  const durDe = (l: MedioLinea) => {
    const spec = specs.find(s => s.medio === l.canal && s.formato === l.formato);
    return spec?.duracion || '';
  };

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-700">
            <th className="py-2 px-2 w-14"> </th>
            <th className="py-2 px-2">Medio / Formato</th>
            <th className="py-2 px-2 w-16">Specs</th>
            <th className="py-2 px-2">Recepción</th>
            <th className="py-2 px-2">Montaje</th>
            <th className="py-2 px-2">Inicio pauta</th>
            <th className="py-2 px-2">Estado QA</th>
            <th className="py-2 px-2">Gestión de material</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(grupos.values()).map(g => (
            <React.Fragment key={`${g.objetivo}-${g.audiencia}`}>
              <tr className="bg-slate-50 dark:bg-slate-700/40">
                <td colSpan={8} className="py-1.5 px-2">
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="font-bold px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">🎯 {g.objetivo}</span>
                    <span className="font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">👥 {g.audiencia}</span>
                    <span className="text-slate-400">{g.items.length} entregable(s)</span>
                  </div>
                </td>
              </tr>
              {g.items.map(l => {
                const le = MEDIO_ESTADO_LABELS[l.estadoQA] || MEDIO_ESTADO_LABELS.PENDIENTE;
                const dur = durDe(l);
                const hasMaterial = Boolean(l.linkMaterial && l.linkMaterial.trim());
                return (
                  <tr key={l.lineId} className="border-b border-slate-50 dark:border-slate-700/50 align-top">
                    <td className="py-2 px-2">
                      {puedeGestionarLineas && (
                        <button onClick={() => onEditar(l)} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-brand text-white hover:bg-brand-600" title="Editar línea">
                          <Pencil size={11} /> Editar
                        </button>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">📺 {l.canal}</div>
                      <div className="text-[11px] text-slate-500">{l.formato}</div>
                      {l.territorio && <div className="text-[10px] text-violet-500">🏷️ {l.territorio}</div>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(l.ratios || []).map(r => (
                          <span key={r} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{r}</span>
                        ))}
                        {dur && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand">⏱️ {dur}</span>}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <button onClick={() => onSpecs(l)} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700" title="Ver ficha técnica">
                        <FileText size={11} /> Specs
                      </button>
                    </td>
                    <td className="py-2 px-2">
                      <DatePill titulo={`Recepción${l.diasRecepcion ? ` (${l.diasRecepcion}d háb.)` : ''}`} valor={l.fechaRecepcion} tono="amber" />
                    </td>
                    <td className="py-2 px-2">
                      <DatePill titulo={`Montaje${l.diasMontaje ? ` (${l.diasMontaje}d háb.)` : ''}`} valor={l.fechaMontaje} tono="violet" />
                    </td>
                    <td className="py-2 px-2">
                      <DatePill titulo="Inicio pauta" valor={l.fechaSalidaPauta} tono="emerald" />
                    </td>
                    <td className="py-2 px-2">
                      {puedeQA ? (
                        <button onClick={() => onEstado(l)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${le.color}`} title="Cambiar estado / ver bitácora">
                          {le.label}
                        </button>
                      ) : (
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${le.color}`} title="Estado QA">
                          {le.label}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {hasMaterial ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a href={l.linkMaterial!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-brand/10 text-brand hover:bg-brand/20" title="Abrir material">
                            <Link2 size={11} /> Material
                          </a>
                          {puedeGestionarLineas && (
                            <button onClick={() => onMaterial(l)} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700" title="Editar material / UTM">
                              <Pencil size={11} /> Editar
                            </button>
                          )}
                        </div>
                      ) : (
                        puedeGestionarLineas ? (
                          <button onClick={() => onMaterial(l)} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-brand hover:text-brand" title="Cargar material y generar UTM">
                            <Upload size={11} /> Cargar material
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DatePill: React.FC<{ titulo: string; valor?: string | null; tono: 'amber' | 'violet' | 'emerald' }> = ({ titulo, valor, tono }) => {
  const tonos = {
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  };
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{titulo}</span>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded w-fit ${tonos[tono]}`}>{valor || '—'}</span>
    </div>
  );
};

export default EntregablesTable;
