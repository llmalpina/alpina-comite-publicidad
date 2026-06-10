import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Clock, ChevronRight, ChevronUp, ChevronDown, CheckCircle2, Loader2, Eye, RefreshCw, Archive, CheckSquare, Square } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { STATUS_LABELS, CONTENT_TYPES } from '../../lib/constants';
import { formatDate, cn } from '../../lib/utils';
import { useSolicitudes } from '../../hooks/useSolicitudes';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { apiFetch } from '../../lib/api';

type QueueTab = 'PENDIENTES' | 'APROBADAS' | 'RECHAZADAS' | 'CON_COMENTARIOS' | 'PUBLICADAS' | 'TODAS';

/** Clave en localStorage para guardar las solicitudes vistas/revisadas por usuario */
const getSeenKey = (userId: string) => `alpina_seen_solicitudes_${userId}`;
const getCheckedKey = (userId: string) => `alpina_checked_solicitudes_${userId}`;

/** Obtiene IDs de solicitudes que el usuario ya "vio" (entró a la pieza) */
function getSeenSolicitudes(userId: string): Set<string> {
  try {
    const data = localStorage.getItem(getSeenKey(userId));
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch { return new Set(); }
}

/** Obtiene IDs de solicitudes que el usuario marcó como "revisadas" (check manual) */
function getCheckedSolicitudes(userId: string): Set<string> {
  try {
    const data = localStorage.getItem(getCheckedKey(userId));
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch { return new Set(); }
}

function saveSeenSolicitudes(userId: string, seen: Set<string>) {
  localStorage.setItem(getSeenKey(userId), JSON.stringify([...seen]));
}

function saveCheckedSolicitudes(userId: string, checked: Set<string>) {
  localStorage.setItem(getCheckedKey(userId), JSON.stringify([...checked]));
}

const RevisionQueuePage: React.FC = () => {
  const { solicitudes, loading, refetch } = useSolicitudes();
  const { user } = useAuth();
  const { hasPermission } = useConfig();
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeQueueTab, setActiveQueueTab] = useState<QueueTab>('PENDIENTES');
  const [solicitanteFilter, setSolicitanteFilter] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Cargar estado de visto/revisado al montar
  useEffect(() => {
    if (user?.id) {
      setSeenIds(getSeenSolicitudes(user.id));
      setCheckedIds(getCheckedSolicitudes(user.id));
    }
  }, [user?.id]);

  // Función para marcar/desmarcar como revisada
  const toggleChecked = (solicitudId: string) => {
    if (!user?.id) return;
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(solicitudId)) {
        next.delete(solicitudId);
      } else {
        next.add(solicitudId);
      }
      saveCheckedSolicitudes(user.id, next);
      return next;
    });
  };

  // Al hacer clic en "Revisar", marcar como vista
  const markAsSeen = (solicitudId: string) => {
    if (!user?.id) return;
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(solicitudId);
      saveSeenSolicitudes(user.id, next);
      return next;
    });
  };

  const isARA = user?.role === 'REVISOR_ARA' || user?.role === 'ADMIN';
  const isLegal = user?.role === 'REVISOR_LEGAL' || user?.role === 'ADMIN';
  const canDelete = hasPermission(user?.role || 'SOLICITANTE', 'eliminar_solicitudes');

  // Lista única de solicitantes para el filtro
  const solicitantes = [...new Set(solicitudes.map(s => (s as any).solicitanteName).filter(Boolean))].sort();

  const handleArchive = async (solicitudId: string) => {
    if (!confirm('¿Archivar esta solicitud? No se eliminará, solo se ocultará de la lista.')) return;
    try {
      await apiFetch(`/solicitudes/${solicitudId}/status`, { method: 'PATCH', body: JSON.stringify({ active: 0 }) });
      refetch();
    } catch {}
  };

  const matchesSearch = (s: any) =>
    s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.consecutive?.toLowerCase().includes(search.toLowerCase()) ||
    s.brand?.toLowerCase().includes(search.toLowerCase()) ||
    s.solicitanteName?.toLowerCase().includes(search.toLowerCase()) ||
    s.contentType?.toLowerCase().includes(search.toLowerCase());

  const filterByTab = (s: any) => {
    if (!matchesSearch(s)) return false;
    if (solicitanteFilter && s.solicitanteName !== solicitanteFilter) return false;
    if (contentTypeFilter && s.contentType !== contentTypeFilter) return false;
    switch (activeQueueTab) {
      case 'PENDIENTES': {
        // Pendientes = ENVIADA o EN_REVISION, pero solo si NO tiene ambas aprobaciones
        const bothApproved = s.approvalARA?.approved && s.approvalLegal?.approved;
        if (bothApproved) return false;
        return ['ENVIADA', 'EN_REVISION', 'CONSOLIDACION'].includes(s.status);
      }
      case 'APROBADAS': {
        // Aprobadas = estado APROBADA o que tenga ambas aprobaciones (por si el status no se actualizó)
        const bothApproved = s.approvalARA?.approved && s.approvalLegal?.approved;
        return s.status === 'APROBADA' || (bothApproved && s.status !== 'APROBADA_OBSERVACIONES' && s.status !== 'RECHAZADA' && s.status !== 'PUBLICADA');
      }
      case 'RECHAZADAS': return s.status === 'RECHAZADA';
      case 'CON_COMENTARIOS': return s.status === 'APROBADA_OBSERVACIONES';
      case 'PUBLICADAS': return s.status === 'PUBLICADA';
      case 'TODAS': return true;
      default: return true;
    }
  };

  const items = solicitudes
    .filter(filterByTab)
    .sort((a, b) => {
      const da = a.createdAt || '';
      const db = b.createdAt || '';
      return sortAsc ? da.localeCompare(db) : db.localeCompare(da);
    });

  // Contadores
  const counts = {
    PENDIENTES: solicitudes.filter(s => {
      const bothApproved = (s as any).approvalARA?.approved && (s as any).approvalLegal?.approved;
      return ['ENVIADA', 'EN_REVISION', 'CONSOLIDACION'].includes(s.status) && !bothApproved;
    }).length,
    APROBADAS: solicitudes.filter(s => {
      const bothApproved = (s as any).approvalARA?.approved && (s as any).approvalLegal?.approved;
      return s.status === 'APROBADA' || (bothApproved && s.status !== 'APROBADA_OBSERVACIONES' && s.status !== 'RECHAZADA' && s.status !== 'PUBLICADA');
    }).length,
    RECHAZADAS: solicitudes.filter(s => s.status === 'RECHAZADA').length,
    CON_COMENTARIOS: solicitudes.filter(s => s.status === 'APROBADA_OBSERVACIONES').length,
    PUBLICADAS: solicitudes.filter(s => s.status === 'PUBLICADA').length,
    TODAS: solicitudes.length,
  };

  // Determina si este revisor ya aprobó una solicitud
  const hasMyApproval = (s: any) => {
    if (isARA && s.approvalARA?.approved) return true;
    if (isLegal && s.approvalLegal?.approved) return true;
    return false;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cola de Revisión</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Piezas pendientes de aprobación.</p>
        </div>
        {!loading && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={refetch} className="text-slate-400 hover:text-slate-600" title="Actualizar">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </Button>
            <div className="flex items-center gap-2 bg-brand-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-brand/10">
              <Clock size={16} className="text-brand" />
              <span className="text-sm font-bold text-brand-800 dark:text-brand-200">{counts.PENDIENTES} Pendientes</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs: filtros por estado */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
        {([
          { key: 'PENDIENTES', label: 'Pendientes', color: 'text-[#1e3a5f]' },
          { key: 'APROBADAS', label: 'Aprobadas', color: 'text-emerald-600' },
          { key: 'CON_COMENTARIOS', label: 'Con comentarios', color: 'text-blue-600' },
          { key: 'RECHAZADAS', label: 'Rechazadas', color: 'text-red-600' },
          { key: 'PUBLICADAS', label: 'Publicadas', color: 'text-violet-600' },
          { key: 'TODAS', label: 'Todas', color: 'text-slate-600' },
        ] as { key: QueueTab; label: string; color: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveQueueTab(tab.key)}
            className={cn('px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors whitespace-nowrap',
              activeQueueTab === tab.key
                ? `bg-white dark:bg-slate-700 ${tab.color} shadow-sm`
                : 'text-slate-400 hover:text-slate-600')}
          >
            {tab.label} ({counts[tab.key]})
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input placeholder="Buscar por marca, consecutivo, título o solicitante..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={solicitanteFilter} onChange={e => setSolicitanteFilter(e.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[180px]">
          <option value="">Todos los solicitantes</option>
          {solicitantes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={contentTypeFilter} onChange={e => setContentTypeFilter(e.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[180px]">
          <option value="">Todos los tipos</option>
          {CONTENT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 size={24} className="animate-spin" /> Cargando cola...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border">
          <CheckCircle2 size={48} className="mx-auto text-emerald-200 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
            {activeQueueTab === 'PENDIENTES' ? '¡Todo al día!' : 'Sin publicaciones aún'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {activeQueueTab === 'PENDIENTES' ? 'No hay piezas pendientes de revisión.' : 'No hay piezas publicadas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header con ordenamiento — solo en desktop */}
          <div className="hidden md:grid md:grid-cols-[auto_1fr_100px_120px_100px_60px_70px_70px_90px] items-center gap-2 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="w-7"></div>
            <div>Solicitud</div>
            <div>Marca</div>
            <div>Tipo</div>
            <button className="flex items-center gap-1 hover:text-slate-700 transition-colors" onClick={() => setSortAsc(v => !v)}>
              {activeQueueTab === 'PENDIENTES' ? 'Recibida' : 'Publicada'} {sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <div className="text-center">Ver.</div>
            <div className="text-center">ARA</div>
            <div className="text-center">Legal</div>
            <div></div>
          </div>

          {/* Cards responsive */}
          {items.map(s => {
            const alreadyApproved = hasMyApproval(s);
            const isPublished = s.status === 'PUBLICADA';
            const isRejected = s.status === 'RECHAZADA';
            const isOutOfCycle = (s as any).outOfCycle === true;
            const isNew = !seenIds.has(s.id);
            const isChecked = checkedIds.has(s.id);

            return (
              <Card key={s.id} className={cn('hover:shadow-md transition-shadow bg-white dark:bg-slate-800',
                isPublished && 'opacity-80',
                isRejected && 'border-l-4 border-l-red-400 opacity-90',
                isOutOfCycle && !isRejected && !isPublished && 'border-l-4 border-l-amber-400',
                isNew && !isPublished && 'ring-1 ring-blue-200'
              )}>
                <CardContent className="p-0">
                  <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_100px_120px_100px_60px_70px_70px_90px] md:items-center gap-3 md:gap-2 p-4">
                    {/* Check de revisada */}
                    <div className="hidden md:flex items-center">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleChecked(s.id); }}
                        className={cn('p-1 rounded transition-colors', isChecked ? 'text-emerald-500 hover:text-emerald-700' : 'text-slate-300 hover:text-slate-500')}
                        title={isChecked ? 'Marcada como revisada' : 'Marcar como revisada'}
                      >
                        {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </div>

                    {/* Solicitud */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm border shrink-0',
                        isRejected ? 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200' :
                        isOutOfCycle ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200' :
                        'bg-brand-50 dark:bg-blue-900/20 text-brand border-brand/10'
                      )}>
                        {s.brand?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm text-slate-900 dark:text-white truncate', isNew && !isPublished ? 'font-black' : 'font-bold')}>{s.title}</p>
                          {isNew && !isPublished && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Nueva" />}
                          {isPublished && <Badge className={STATUS_LABELS['PUBLICADA'].color}>{STATUS_LABELS['PUBLICADA'].label}</Badge>}
                          {isRejected && <Badge className="bg-red-100 text-red-700 text-[9px]">Rechazada</Badge>}
                          {s.status === 'APROBADA' && <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Aprobada</Badge>}
                          {s.status === 'APROBADA_OBSERVACIONES' && <Badge className="bg-blue-100 text-blue-700 text-[9px]">Con comentarios</Badge>}
                          {isOutOfCycle && !isRejected && !isPublished && <Badge className="bg-amber-100 text-amber-700 text-[9px]">Sig. ciclo</Badge>}
                        </div>
                        <p className={cn('text-[11px] truncate', isNew && !isPublished ? 'text-slate-700 font-semibold' : 'text-slate-500')}>{s.consecutive} · {s.solicitanteName}</p>
                      </div>
                    </div>

                    {/* Marca */}
                    <div className="hidden md:block min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{s.brand}</p>
                      <p className="text-[10px] text-slate-400 truncate">{s.area}</p>
                    </div>

                    {/* Tipo de contenido */}
                    <div className="hidden md:block min-w-0">
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                        {CONTENT_TYPES.find(ct => ct.value === (s as any).contentType)?.label || (s as any).contentType || '—'}
                      </p>
                    </div>

                    {/* Fecha */}
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{formatDate(isPublished ? (s.updatedAt || s.createdAt) : s.createdAt)}</p>
                      <p className="text-[10px] text-slate-400">{s.createdAt ? new Date(s.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    </div>

                    {/* Versión */}
                    <div className="text-center">
                      <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 text-[10px]">v{s.currentVersion || 1}</Badge>
                    </div>

                    {/* ARA */}
                    <div className="text-center">
                      {(() => {
                        const araApproved = (s as any).approvalARA?.approved;
                        const araHasComments = (s as any).araReviewing === true;
                        return (
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                            araApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            araHasComments ? 'bg-purple-100 text-purple-700 border-purple-200' :
                            'bg-slate-100 text-slate-400 border-slate-200')}>
                            {araApproved ? '✓' : araHasComments ? '✎' : '—'}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Legal */}
                    <div className="text-center">
                      {(() => {
                        const legalApproved = (s as any).approvalLegal?.approved;
                        const legalHasComments = (s as any).legalReviewing === true;
                        return (
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                            legalApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            legalHasComments ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-slate-100 text-slate-400 border-slate-200')}>
                            {legalApproved ? '✓' : legalHasComments ? '✎' : '—'}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Acción */}
                    <div className="flex flex-col gap-1">
                      {isPublished ? (
                        <Link to={`/revision/${s.id}`} onClick={() => markAsSeen(s.id)}>
                          <Button variant="outline" size="sm" className="gap-1 w-full text-slate-500"><Eye size={14} /> Ver</Button>
                        </Link>
                      ) : alreadyApproved ? (
                        <Link to={`/revision/${s.id}`} onClick={() => markAsSeen(s.id)}>
                          <Button variant="outline" size="sm" className="gap-1 w-full text-emerald-600 border-emerald-200">
                            <CheckCircle2 size={14} /> Aprobada
                          </Button>
                        </Link>
                      ) : (
                        <Link to={`/revision/${s.id}`} onClick={() => markAsSeen(s.id)}>
                          <Button size="sm" className="gap-1 w-full">Revisar <ChevronRight size={14} /></Button>
                        </Link>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" className="gap-1 w-full text-red-500 hover:bg-red-50 text-[10px] h-7"
                          onClick={(e) => { e.preventDefault(); handleArchive(s.id); }}>
                          <Archive size={12} /> Archivar
                        </Button>
                      )}
                      {/* Check de revisada (mobile) */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleChecked(s.id); }}
                        className={cn('md:hidden flex items-center justify-center gap-1 text-[10px] font-semibold h-7 rounded px-2 transition-colors',
                          isChecked ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-slate-400 bg-slate-50 border border-slate-200 hover:text-slate-600')}
                      >
                        {isChecked ? <CheckSquare size={12} /> : <Square size={12} />}
                        {isChecked ? 'Revisada' : 'Marcar'}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RevisionQueuePage;
