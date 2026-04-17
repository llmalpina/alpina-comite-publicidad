import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useSolicitudes } from '../../hooks/useSolicitudes';
import { useMaestros } from '../../contexts/MaestrosContext';
import { cn } from '../../lib/utils';

const BolsaHorasIndicator: React.FC = () => {
  const { solicitudes } = useSolicitudes();
  const { config } = useMaestros();

  // Calcular horas consumidas esta semana
  const { horasSemanales, horasMaxSemana, porTipo } = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);

    // Mapa de minutos por tipo de contenido
    const minutosMap: Record<string, number> = {};
    config.tiposContenido.forEach(t => {
      minutosMap[t.value] = (t as any).minutos || 40;
    });

    // Solicitudes de esta semana
    const thisWeek = solicitudes.filter(s => new Date(s.createdAt) >= startOfWeek);

    // Calcular minutos consumidos por tipo
    const porTipoCalc: { tipo: string; label: string; count: number; minutos: number }[] = [];
    const countByType: Record<string, number> = {};
    thisWeek.forEach(s => {
      countByType[s.contentType] = (countByType[s.contentType] || 0) + 1;
    });

    let totalMinutos = 0;
    Object.entries(countByType).forEach(([tipo, count]) => {
      const min = minutosMap[tipo] || 40;
      const tipoInfo = config.tiposContenido.find(t => t.value === tipo);
      porTipoCalc.push({ tipo, label: tipoInfo?.label || tipo, count, minutos: count * min });
      totalMinutos += count * min;
    });

    // Calcular horas máximas semanales (suma de contenidosSemana * minutos)
    let maxMinutos = 0;
    config.tiposContenido.forEach(t => {
      const sem = (t as any).contenidosSemana || 0;
      const min = (t as any).minutos || 40;
      maxMinutos += sem * min;
    });

    return {
      horasSemanales: Math.round(totalMinutos / 60 * 10) / 10,
      horasMaxSemana: Math.round(maxMinutos / 60 * 10) / 10,
      porTipo: porTipoCalc.sort((a, b) => b.minutos - a.minutos),
    };
  }, [solicitudes, config]);

  const porcentaje = horasMaxSemana > 0 ? Math.min(100, Math.round((horasSemanales / horasMaxSemana) * 100)) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Clock size={16} className="text-[#1e3a5f]" /> Horas de revisión esta semana
        </h4>
        <span className={cn('text-lg font-black', porcentaje > 80 ? 'text-red-600' : porcentaje > 50 ? 'text-amber-600' : 'text-emerald-600')}>
          {horasSemanales}h
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
        <div className={cn('h-2.5 rounded-full transition-all', porcentaje > 80 ? 'bg-red-500' : porcentaje > 50 ? 'bg-amber-500' : 'bg-emerald-500')}
          style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="text-[10px] text-slate-400">{horasSemanales} de {horasMaxSemana} horas estimadas ({porcentaje}%)</p>

      {/* Desglose por tipo */}
      {porTipo.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
          {porTipo.slice(0, 5).map(t => (
            <div key={t.tipo} className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 truncate max-w-[180px]">{t.label}</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold shrink-0">{t.count} × {Math.round((t.minutos / t.count))}min = {Math.round(t.minutos / 60 * 10) / 10}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BolsaHorasIndicator;
