import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader2, RefreshCw, CheckCircle2, Clock, PlayCircle, Users } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';
import ArteFlowCard from '../../../components/artes/ArteFlowCard';
import { useArtes } from '../../../contexts/ArtesContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { artesApi } from '../../../lib/artes-api';
import { solicitudesApi } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import type { ArteFlow, ArteTeamRef } from '../../../types/artes';

type Tab = 'MI_TURNO' | 'EN_CURSO' | 'DEVUELTOS' | 'APROBADOS' | 'TODAS';

const ArtesColaPage: React.FC = () => {
  const { config, canVerCola, canAprobar, isArtesAdmin, designTeam } = useArtes();
  const { notify } = useNotifications();

  const [items, setItems] = useState<ArteFlow[]>([]);
  const [teams, setTeams] = useState<ArteTeamRef[]>([]);
  const [myTeams, setMyTeams] = useState<ArteTeamRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('MI_TURNO');
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  // Piezas elegibles sin flujo (solo para el admin del flujo)
  const [pendientesInicio, setPendientesInicio] = useState<any[]>([]);
  const [iniciando, setIniciando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await artesApi.list();
      setItems(res.items || []);
      setTeams(res.teams || []);
      setMyTeams(res.myTeams || []);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la cola de artes');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // El admin puede arrancar el flujo de piezas aprobadas antes de este módulo
  const cargarPendientesInicio = useCallback(async (flujos: ArteFlow[]) => {
    if (!isArtesAdmin) return;
    try {
      const solicitudes = await solicitudesApi.list();
      const conFlujo = new Set(flujos.map(f => f.solicitudId));
      setPendientesInicio(
        (solicitudes || []).filter((s: any) =>
          config.contentTypes.includes(s.contentType)
          && config.startOnStatuses.includes(s.status)
          && !conFlujo.has(s.id))
      );
    } catch { setPendientesInicio([]); }
  }, [isArtesAdmin, config.contentTypes, config.startOnStatuses]);

  useEffect(() => { if (!loading) cargarPendientesInicio(items); }, [loading, items, cargarPendientesInicio]);

  const myTeamIds = useMemo(() => myTeams.map(t => t.id), [myTeams]);
  const esMiTurno = useCallback(
    (f: ArteFlow) => !!f.currentTeamId && myTeamIds.includes(f.currentTeamId),
    [myTeamIds],
  );

  const marcas = useMemo(
    () => [...new Set(items.map(f => f.brand).filter(Boolean))].sort(),
    [items],
  );

  const coincide = useCallback((f: ArteFlow) => {
    const q = search.trim().toLowerCase();
    if (q && ![f.title, f.consecutive, f.brand, f.solicitanteName, f.product]
      .some(v => String(v || '').toLowerCase().includes(q))) return false;
    if (brandFilter && f.brand !== brandFilter) return false;
    if (teamFilter && f.currentTeamId !== teamFilter) return false;
    return true;
  }, [search, brandFilter, teamFilter]);

  const porTab = useCallback((f: ArteFlow, t: Tab) => {
    switch (t) {
      case 'MI_TURNO': return esMiTurno(f);
      case 'EN_CURSO': return f.estado === 'EN_CURSO';
      case 'DEVUELTOS': return f.estado === 'DEVUELTO_DISENO';
      case 'APROBADOS': return f.estado === 'APROBADO';
      case 'TODAS': return true;
      default: return true;
    }
  }, [esMiTurno]);

  const counts = useMemo(() => ({
    MI_TURNO: items.filter(f => porTab(f, 'MI_TURNO')).length,
    EN_CURSO: items.filter(f => porTab(f, 'EN_CURSO')).length,
    DEVUELTOS: items.filter(f => porTab(f, 'DEVUELTOS')).length,
    APROBADOS: items.filter(f => porTab(f, 'APROBADOS')).length,
    TODAS: items.length,
  }), [items, porTab]);

  const visibles = useMemo(
    () => items
      .filter(f => porTab(f, tab) && coincide(f))
      .sort((a, b) => {
        // Primero lo que espera por mí, luego lo más antiguo sin moverse
        const mine = Number(esMiTurno(b)) - Number(esMiTurno(a));
        if (mine !== 0) return mine;
        return String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''));
      }),
    [items, tab, coincide, porTab, esMiTurno],
  );

  const iniciarFlujo = async (solicitudId: string) => {
    setIniciando(solicitudId);
    try {
      await artesApi.start(solicitudId);
      notify('Flujo de firmas iniciado. Se notificó al primer equipo.', 'success');
      await cargar();
    } catch (e: any) {
      notify(e?.message || 'No se pudo iniciar el flujo', 'error');
    } finally {
      setIniciando(null);
    }
  };

  if (!canVerCola) {
    return (
      <div className="text-center py-20">
        <Users size={48} className="mx-auto text-slate-200 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">Sin acceso</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          No perteneces a ningún equipo de aprobación de artes. Pide al administrador que te agregue
          en <strong>Artes &gt; Equipos y firmas</strong>.
        </p>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; color: string }[] = [
    { key: 'MI_TURNO', label: 'Mi turno', color: 'text-[#1e3a5f]' },
    { key: 'EN_CURSO', label: 'En firmas', color: 'text-blue-600' },
    { key: 'DEVUELTOS', label: 'Devueltos a Diseño', color: 'text-pink-600' },
    { key: 'APROBADOS', label: 'Aprobados', color: 'text-emerald-600' },
    { key: 'TODAS', label: 'Todas', color: 'text-slate-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Aprobación de artes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {myTeams.length > 0
              ? <>Firmas pendientes de {myTeams.map(t => t.label).join(', ')}.</>
              : 'Piezas en flujo de firmas por equipos.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={cargar} className="text-slate-400 hover:text-slate-600" title="Actualizar">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </Button>
          <div className="flex items-center gap-2 bg-brand-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-brand/10">
            <Clock size={16} className="text-brand" />
            <span className="text-sm font-bold text-brand-800 dark:text-brand-200">{counts.MI_TURNO} por firmar</span>
          </div>
        </div>
      </div>

      {!config.enabled && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          El flujo de aprobación por equipos está <strong>desactivado</strong>. Las piezas nuevas no entrarán al flujo.
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Piezas listas para entrar al flujo (admin) */}
      {isArtesAdmin && pendientesInicio.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {pendientesInicio.length} pieza{pendientesInicio.length === 1 ? '' : 's'} aprobada{pendientesInicio.length === 1 ? '' : 's'} por el comité sin flujo de firmas
            </p>
            {pendientesInicio.slice(0, 8).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{s.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{s.consecutive} · {s.brand}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1 shrink-0" disabled={iniciando === s.id} onClick={() => iniciarFlujo(s.id)}>
                  {iniciando === s.id ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} Iniciar flujo
                </Button>
              </div>
            ))}
            {pendientesInicio.length > 8 && (
              <p className="text-[11px] text-slate-400">Y {pendientesInicio.length - 8} más…</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors whitespace-nowrap',
              tab === t.key ? `bg-white dark:bg-slate-700 ${t.color} shadow-sm` : 'text-slate-400 hover:text-slate-600')}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Buscar por pieza, consecutivo, marca o solicitante..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
          className="flex h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm w-full sm:w-auto sm:min-w-[150px]"
        >
          <option value="">Todas las marcas</option>
          {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="flex h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm w-full sm:w-auto sm:min-w-[170px]"
        >
          <option value="">Turno de cualquier equipo</option>
          {teams.map(t => <option key={t.id} value={t.id}>Turno de {t.label}</option>)}
          {designTeam && <option value={designTeam.id}>Turno de {designTeam.label}</option>}
        </select>
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 size={24} className="animate-spin" /> Cargando artes...
        </div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border">
          <CheckCircle2 size={48} className="mx-auto text-emerald-200 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
            {tab === 'MI_TURNO' ? '¡Todo al día!' : 'Sin resultados'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {tab === 'MI_TURNO'
              ? 'No hay artes esperando la firma de tu equipo.'
              : 'Ajusta los filtros para ver otras piezas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map(f => (
            <ArteFlowCard
              key={f.solicitudId}
              flow={f}
              teams={teams}
              esMiTurno={esMiTurno(f)}
              accionLabel={canAprobar ? 'Revisar y firmar' : 'Revisar'}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtesColaPage;
