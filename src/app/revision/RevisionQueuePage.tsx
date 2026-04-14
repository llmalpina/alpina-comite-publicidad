import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Clock, ChevronRight, ChevronUp, ChevronDown, CheckCircle2, Loader2, Eye, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { STATUS_LABELS } from '../../lib/constants';
import { formatDate, cn } from '../../lib/utils';
import { useSolicitudes } from '../../hooks/useSolicitudes';
import { useAuth } from '../../contexts/AuthContext';

type QueueTab = 'PENDIENTES' | 'PUBLICADAS';

const RevisionQueuePage: React.FC = () => {
  const { solicitudes, loading, refetch } = useSolicitudes();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeQueueTab, setActiveQueueTab] = useState<QueueTab>('PENDIENTES');

  const isARA = user?.role === 'REVISOR_ARA' || user?.role === 'ADMIN';
  const isLegal = user?.role === 'REVISOR_LEGAL' || user?.role === 'ADMIN';

  const matchesSearch = (s: any) =>
    s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.consecutive?.toLowerCase().includes(search.toLowerCase()) ||
    s.brand?.toLowerCase().includes(search.toLowerCase());

  const pending = solicitudes
    .filter(s =>
      ['ENVIADA', 'EN_REVISION'].includes(s.status) &&
      matchesSearch(s)
    )
    .sort((a, b) => {
      const da = a.createdAt || '';
      const db = b.createdAt || '';
      return sortAsc ? da.localeCompare(db) : db.localeCompare(da);
    });

  const published = solicitudes
    .filter(s => s.status === 'PUBLICADA' && matchesSearch(s))
    .sort((a, b) => {
      const da = a.updatedAt || a.createdAt || '';
      const db = b.updatedAt || b.createdAt || '';
      return db.localeCompare(da);
    });

  const publishedCount = solicitudes.filter(s => s.status === 'PUBLICADA').length;

  // Determina si este revisor ya aprobó una solicitud
  const hasMyApproval = (s: any) => {
    if (isARA && s.approvalARA?.approved) return true;
    if (isLegal && s.approvalLegal?.approved) return true;
    return false;
  };

  const items = activeQueueTab === 'PENDIENTES' ? pending : published;

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
              <span className="text-sm font-bold text-brand-800 dark:text-brand-200">{pending.length} Pendientes</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs: Pendientes / Publicadas */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveQueueTab('PENDIENTES')}
          className={cn('px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors',
            activeQueueTab === 'PENDIENTES'
              ? 'bg-white dark:bg-slate-700 text-[#1e3a5f] shadow-sm'
              : 'text-slate-400 hover:text-slate-600')}
        >
          Pendientes ({pending.length})
        </button>
        <button
          onClick={() => setActiveQueueTab('PUBLICADAS')}
          className={cn('px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors',
            activeQueueTab === 'PUBLICADAS'
              ? 'bg-white dark:bg-slate-700 text-violet-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-600')}
        >
          Publicadas ({publishedCount})
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input placeholder="Buscar por marca, consecutivo o título..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
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
          <div className="hidden md:grid md:grid-cols-[1fr_100px_100px_60px_70px_70px_90px] items-center gap-2 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div>Solicitud</div>
            <div>Marca</div>
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

            return (
              <Card key={s.id} className={cn('hover:shadow-md transition-shadow', isPublished && 'opacity-80')}>
                <CardContent className="p-0">
                  <div className="flex flex-col md:grid md:grid-cols-[1fr_100px_100px_60px_70px_70px_90px] md:items-center gap-3 md:gap-2 p-4">
                    {/* Solicitud */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-brand-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-brand font-bold text-sm border border-brand/10 shrink-0">
                        {s.brand?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{s.title}</p>
                          {isPublished && <Badge className={STATUS_LABELS['PUBLICADA'].color}>{STATUS_LABELS['PUBLICADA'].label}</Badge>}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{s.consecutive} · {s.solicitanteName}</p>
                      </div>
                    </div>

                    {/* Marca */}
                    <div className="hidden md:block min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{s.brand}</p>
                      <p className="text-[10px] text-slate-400 truncate">{s.area}</p>
                    </div>

                    {/* Fecha */}
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{formatDate(isPublished ? (s.updatedAt || s.createdAt) : s.createdAt)}</p>
                    </div>

                    {/* Versión */}
                    <div className="text-center">
                      <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 text-[10px]">v{s.currentVersion || 1}</Badge>
                    </div>

                    {/* ARA */}
                    <div className="text-center">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                        (s as any).approvalARA?.approved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        'bg-slate-100 text-slate-400 border-slate-200')}>
                        {(s as any).approvalARA?.approved ? '✓' : '—'}
                      </span>
                    </div>

                    {/* Legal */}
                    <div className="text-center">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                        (s as any).approvalLegal?.approved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        'bg-slate-100 text-slate-400 border-slate-200')}>
                        {(s as any).approvalLegal?.approved ? '✓' : '—'}
                      </span>
                    </div>

                    {/* Acción */}
                    <div>
                      {isPublished ? (
                        <Link to={`/revision/${s.id}`}>
                          <Button variant="outline" size="sm" className="gap-1 w-full text-slate-500"><Eye size={14} /> Ver</Button>
                        </Link>
                      ) : alreadyApproved ? (
                        <Link to={`/revision/${s.id}`}>
                          <Button variant="outline" size="sm" className="gap-1 w-full text-emerald-600 border-emerald-200">
                            <CheckCircle2 size={14} /> Aprobada
                          </Button>
                        </Link>
                      ) : (
                        <Link to={`/revision/${s.id}`}>
                          <Button size="sm" className="gap-1 w-full">Revisar <ChevronRight size={14} /></Button>
                        </Link>
                      )}
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
