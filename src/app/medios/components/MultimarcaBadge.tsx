import React from 'react';
import { Badge } from '../../../components/ui/Badge';

/**
 * Chip de marca(s) de una campaña o pieza.
 * - >1 marca → chip violet "Multimarca" con tooltip de las marcas que contiene.
 * - 1 marca  → Badge normal con el nombre de la marca.
 * - 0 marcas → "Sin marca" atenuado.
 */
const MultimarcaBadge: React.FC<{ marcas?: string[]; className?: string }> = ({ marcas, className }) => {
  const lista = (marcas || []).filter(m => m && m.trim());

  if (lista.length > 1) {
    return (
      <span
        title={`Contiene: ${lista.join(', ')}`}
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ${className || ''}`}
      >
        Multimarca
      </span>
    );
  }

  if (lista.length === 1) {
    return <Badge variant="secondary" className={className}>{lista[0]}</Badge>;
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-slate-400 dark:text-slate-500 ${className || ''}`}>
      Sin marca
    </span>
  );
};

export default MultimarcaBadge;
