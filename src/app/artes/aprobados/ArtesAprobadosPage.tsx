import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Loader2, RefreshCw, Archive, Download, FileCheck2, Eye, Calendar,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useArtes } from '../../../contexts/ArtesContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { artesApi } from '../../../lib/artes-api';
import { exportArteFirmado } from '../../../lib/artes-pdf';
import { cn, formatDate } from '../../../lib/utils';
import type { ArteFlow, ArteTeamRef } from '../../../types/artes';

/**
 * Repositorio de artes que completaron todas las firmas.
 * Permite filtrar por marca, equipo, año y texto, y descargar el PDF firmado
 * (el arte vigente más la hoja final con las firmas de cada equipo).
 */
const ArtesAprobadosPage: React.FC = () => {
  const { canVerRepositorio } = useArtes();
  const { notify } = useNotifications();

  const [items, setItems] = useState<ArteFlow[]>([]);
  const [teams, setTeams] = useState<ArteTeamRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [anioFilter, setAnioFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [orden, setOrden] = useState<'reciente' | 'antiguo'>('reciente');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await artesApi.list({ estado: 'APROBADO' });
      setItems((res.items || []).filter(f => f.estado === 'APROBADO'));
      setTeams(res.teams || []);
    } catch (e: any) {
      notify(e?.message || 'No se pudo cargar el repositorio', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { cargar(); }, [cargar]);

  const marcas = useMemo(() => [...new Set(items.map(f => f.brand).filter(Boolean))].sort(), [items]);
  const anios = useMemo(
    () => [...new Set(items.map(f => String(new Date(f.completedAt || f.updatedAt).getFullYear())))]
      .filter(a => a !== 'NaN').sort().reverse(),
    [items],
  );

  const visibles = useMemo(() => items
    .filter(f => {
      const q = search.trim().toLowerCase();
      if (q && ![f.title, f.consecutive, f.brand, f.solicitanteName, f.product]
        .some(v => String(v || '').toLowerCase().includes(q))) return false;
      if (brandFilter && f.brand !== brandFilter) return false;
      if (anioFilter && String(new Date(f.completedAt || f.updatedAt).getFullYear()) !== anioFilter) return false;
      if (teamFilter && !(f.teamOrder || []).includes(teamFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      const da = a.completedAt || a.updatedAt || '';
      const db = b.completedAt || b.updatedAt || '';
      return orden === 'reciente' ? db.localeCompare(da) : da.localeCompare(db);
    }), [items, search, brandFilter, anioFilter, teamFilter, orden]);

  const descargarFirmado = async (flow: ArteFlow) => {
    setDescargando(flow.solicitudId);
    try {
      // El detalle trae el historial completo de decisiones para la hoja de firmas
      const detalle = await artesApi.get(flow.solicitudId);
      await exportArteFirmado({
        flow: detalle.flow,
        approvals: detalle.approvals,
        teams: detalle.teams,
      });
      notify('PDF firmado descargado', 'success');
    } catch (e: any) {
      notify(e?.message || 'No se pudo generar el PDF firmado', 'error');
    } finally {
      setDescargando(null);
    }
  };

  if (!canVerRepositorio) {
    return (
      <div className="text-center py-20">
        <Archive size={48} className="mx-auto text-slate-200 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">Sin acceso</h3>
        <p className="text-slate-500">No tienes permiso para ver el repositorio de artes aprobados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Artes aprobados</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Repositorio de artes con todas las firmas completas y su PDF firmado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={cargar} className="text-slate-400 hover:text-slate-600" title="Actualizar">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </Button>
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-200">
            <FileCheck2 size={16} className="text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{items.length} aprobados</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Buscar por pieza, consecutivo, marca o solicitante..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
          className="flex h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm lg:min-w-[140px]">
          <option value="">Todas las marcas</option>
          {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
          className="flex h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm lg:min-w-[160px]">
          <option value="">Cualquier equipo</option>
          {teams.map(t => <option key={t.id} value={t.id}>Firmado por {t.label}</option>)}
        </select>
        <select value={anioFilter} onChange={e => setAnioFilter(e.target.value)}
          className="flex h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm lg:min-w-[110px]">
          <option value="">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={orden} onChange={e => setOrden(e.target.value as 'reciente' | 'antiguo')}
          className="flex h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm lg:min-w-[140px]">
          <option value="reciente">Más recientes</option>
          <option value="antiguo">Más antiguos</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 size={24} className="animate-spin" /> Cargando repositorio...
        </div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border">
          <Archive size={48} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Sin artes aprobados</h3>
          <p className="text-slate-500 dark:text-slate-400">
            {items.length === 0
              ? 'Todavía ningún arte completó todas las firmas.'
              : 'Ningún arte coincide con los filtros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map(f => {
            const firmas = (f.teamOrder || []).map(id => ({ id, firma: (f.approvals || {})[id] }));
            return (
              <Card key={f.solicitudId} className="border-l-4 border-l-emerald-400 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto] lg:items-center gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm border bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0">
                        {f.brand?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{f.title}</p>
                          <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Aprobado</Badge>
                          <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 text-[9px]">v{f.arteVersion}</Badge>
                          {f.cycle > 1 && <Badge className="bg-amber-100 text-amber-700 text-[9px]">{f.cycle} rondas</Badge>}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {f.consecutive} · {f.brand} · {f.solicitanteName}
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                          <Calendar size={11} /> Aprobado el {formatDate(f.completedAt || f.updatedAt)}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {firmas.map(({ id, firma }) => {
                            const team = teams.find(t => t.id === id);
                            return (
                              <span
                                key={id}
                                title={firma ? `${firma.by} · ${new Date(firma.at).toLocaleString('es-CO')}` : 'Sin firma'}
                                className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                                  firma ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200')}
                              >
                                {team?.label || id}{firma?.by ? `: ${firma.by}` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Link to={`/artes/${f.solicitudId}`}>
                        <Button size="sm" variant="outline" className="gap-1"><Eye size={14} /> Ver</Button>
                      </Link>
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={descargando === f.solicitudId}
                        onClick={() => descargarFirmado(f)}
                      >
                        {descargando === f.solicitudId
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Download size={14} />} PDF firmado
                      </Button>
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

export default ArtesAprobadosPage;
