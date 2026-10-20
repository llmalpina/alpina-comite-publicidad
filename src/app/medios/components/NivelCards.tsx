import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';

export interface NivelCardItem {
  key: string;
  title: string;
  subtitle?: string;
  /** Total de piezas activas (no canceladas) del nivel. */
  activas: number;
  /** Piezas implementadas del nivel. */
  implementadas: number;
  /** Nº de hijos (marcas o campañas) agrupados bajo este nivel. */
  hijos?: number;
  hijosLabel?: string;
  onClick: () => void;
}

/** % de cumplimiento = implementadas / activas (sobre activas, nunca sobre total). */
function pct(implementadas: number, activas: number): number {
  return activas > 0 ? Math.round((implementadas / activas) * 100) : 0;
}

function barColor(p: number): string {
  if (p >= 100) return 'bg-emerald-500';
  if (p >= 60) return 'bg-violet-500';
  if (p >= 30) return 'bg-amber-400';
  return 'bg-blue-400';
}

/** Grid de tarjetas con % de cumplimiento por nivel (canchas/marcas/campañas). */
const NivelCards: React.FC<{ items: NivelCardItem[]; icon?: string }> = ({ items, icon = '🏬' }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map(item => {
      const p = pct(item.implementadas, item.activas);
      return (
        <button key={item.key} onClick={item.onClick} className="text-left block w-full">
          <Card className="hover:shadow-md hover:border-brand/30 transition-all cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{icon} {item.title}</p>
                  {item.subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.subtitle}</p>}
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>{item.hijos != null ? `${item.hijos} ${item.hijosLabel || ''}` : `${item.activas} pieza(s)`}</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{p}% cumplido</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                <div className={barColor(p)} style={{ width: `${p}%`, height: '100%' }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {item.implementadas}/{item.activas} implementadas
              </p>
            </CardContent>
          </Card>
        </button>
      );
    })}
  </div>
);

export default NivelCards;
