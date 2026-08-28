import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Check, Clock, PenTool, Eye } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn, formatDate } from '../../lib/utils';
import { ARTE_ESTADO_LABELS } from '../../types/artes';
import type { ArteFlow, ArteTeamRef } from '../../types/artes';

/**
 * Fila de un arte en la cola y en el repositorio.
 * Muestra la secuencia de equipos con su estado de firma para que se vea de un
 * vistazo en qué punto del flujo va la pieza.
 */
export const ArteFlowCard: React.FC<{
  flow: ArteFlow;
  teams: ArteTeamRef[];
  /** El usuario pertenece al equipo que tiene el turno */
  esMiTurno?: boolean;
  /** Etiqueta del botón principal */
  accionLabel?: string;
}> = ({ flow, teams, esMiTurno, accionLabel }) => {
  const estado = ARTE_ESTADO_LABELS[flow.estado] || ARTE_ESTADO_LABELS.EN_CURSO;
  const aprobado = flow.estado === 'APROBADO';
  const devuelto = flow.estado === 'DEVUELTO_DISENO';
  const secuencia = teams.length
    ? teams
    : (flow.teamOrder || []).map(id => ({ id, label: id } as ArteTeamRef));

  const dias = Math.max(0, Math.floor((Date.now() - new Date(flow.updatedAt || flow.createdAt).getTime()) / 86400000));

  return (
    <Card className={cn('hover:shadow-md transition-shadow bg-white dark:bg-slate-800',
      esMiTurno && 'ring-2 ring-brand/40 border-brand/30',
      devuelto && 'border-l-4 border-l-pink-400',
      aprobado && 'border-l-4 border-l-emerald-400',
    )}>
      <CardContent className="p-4">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_auto] lg:items-center gap-3">
          {/* Identificación */}
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm border shrink-0',
              aprobado ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : devuelto ? 'bg-pink-50 text-pink-600 border-pink-200'
                : 'bg-brand-50 dark:bg-blue-900/20 text-brand border-brand/10')}>
              {flow.brand?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{flow.title}</p>
                <Badge className={cn('text-[9px]', estado.color)}>{estado.label}</Badge>
                {esMiTurno && <Badge className="bg-brand text-white text-[9px]">Tu turno</Badge>}
                <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 text-[9px]">v{flow.arteVersion}</Badge>
                {flow.cycle > 1 && (
                  <Badge className="bg-amber-100 text-amber-700 text-[9px]">Ronda {flow.cycle}</Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {flow.consecutive} · {flow.brand} · {flow.solicitanteName}
              </p>

              {/* Secuencia de firmas */}
              <div className="flex flex-wrap items-center gap-1 mt-2">
                {secuencia.map((t, i) => {
                  const firma = (flow.approvals || {})[t.id];
                  const firmado = firma?.decision === 'APROBADO';
                  const turno = flow.currentTeamId === t.id;
                  return (
                    <React.Fragment key={t.id}>
                      {i > 0 && <ChevronRight size={10} className="text-slate-300 shrink-0" />}
                      <span
                        title={firma
                          ? `${t.label}: ${firma.decision === 'APROBADO' ? 'aprobó' : 'devolvió'} ${firma.by} · ${new Date(firma.at).toLocaleString('es-CO')}`
                          : turno ? `${t.label}: pendiente de firma` : `${t.label}: en espera`}
                        className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                          firmado ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : turno ? 'bg-brand-50 text-brand border-brand/30'
                            : 'bg-slate-50 text-slate-400 border-slate-200')}
                      >
                        {firmado ? <Check size={9} /> : turno ? <Clock size={9} /> : null}
                        {t.label}
                      </span>
                    </React.Fragment>
                  );
                })}
                {devuelto && (
                  <>
                    <ChevronRight size={10} className="text-slate-300" />
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                      <PenTool size={9} /> Diseño
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Fechas */}
          <div className="lg:text-right shrink-0">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {aprobado ? 'Aprobado' : 'Actualizado'}: {formatDate(flow.completedAt || flow.updatedAt || flow.createdAt)}
            </p>
            {!aprobado && (
              <p className={cn('text-[10px]', dias >= 7 ? 'text-red-500 font-semibold' : 'text-slate-400')}>
                {dias} {dias === 1 ? 'día' : 'días'} en espera
              </p>
            )}
          </div>

          {/* Acción */}
          <div className="shrink-0">
            <Link to={`/artes/${flow.solicitudId}`}>
              <Button size="sm" variant={esMiTurno ? 'default' : 'outline'} className="gap-1 w-full lg:w-auto">
                {esMiTurno ? <>{accionLabel || 'Revisar y firmar'} <ChevronRight size={14} /></> : <><Eye size={14} /> Ver</>}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ArteFlowCard;
