import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbSegment {
  label: string;
  /** Si viene, el segmento es un enlace (onClick). El último suele ir sin onClick. */
  onClick?: () => void;
}

/** Miga de pan Canchas › Cancha › Marca › Campaña. Estilo app (Tailwind + brand). */
const Breadcrumb: React.FC<{ segments: BreadcrumbSegment[] }> = ({ segments }) => (
  <nav className="flex items-center gap-1 flex-wrap text-xs" aria-label="Ruta de navegación">
    {segments.map((s, i) => {
      const last = i === segments.length - 1;
      return (
        <React.Fragment key={`${s.label}-${i}`}>
          {s.onClick && !last ? (
            <button
              onClick={s.onClick}
              className="font-semibold text-slate-500 hover:text-brand transition-colors"
            >
              {s.label}
            </button>
          ) : (
            <span className={last ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-500'}>
              {s.label}
            </span>
          )}
          {!last && <ChevronRight size={13} className="text-slate-300 dark:text-slate-600" />}
        </React.Fragment>
      );
    })}
  </nav>
);

export default Breadcrumb;
