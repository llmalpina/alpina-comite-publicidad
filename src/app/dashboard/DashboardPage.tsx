import React, { useState, useMemo } from 'react';
import { FileText, CheckCircle2, XCircle, Clock, TrendingUp, ArrowRight, PlusCircle, Loader2, Filter, Calendar, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { STATUS_LABELS } from '../../lib/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import { useSolicitudes } from '../../hooks/useSolicitudes';
import { formatDate, cn } from '../../lib/utils';

type DateRange = 'semana' | 'mes' | 'trimestre' | 'anio' | 'todo';

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'trimestre', label: 'Último trimestre' },
  { value: 'anio', label: 'Este año' },
  { value: 'todo', label: 'Todo' },
];

const BRAND_COLORS: Record<string, string> = {
  'Alpina': '#1e3a5f', 'Bon Yurt': '#e11d48', 'Alpin': '#7c3aed', 'Finesse': '#059669',
  'Yox': '#d97706', 'Avena Alpina': '#0284c7', 'Arequipe Alpina': '#9333ea',
  'Baby Gü': '#ec4899', 'Regeneris': '#14b8a6',
};

function getDateThreshold(range: DateRange): Date {
  const now = new Date();
  switch (range) {
    case 'semana': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    case 'mes': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'trimestre': return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    case 'anio': return new Date(now.getFullYear(), 0, 1);
    default: return new Date(2020, 0, 1);
  }
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { solicitudes, loading } = useSolicitudes();
  const { canSubmitNow, hasPermission } = useConfig();
  const scheduleCheck = canSubmitNow(user?.role || 'SOLICITANTE');
  const [dateRange, setDateRange] = useState<DateRange>('mes');
  const [brandFilter, setBrandFilter] = useState<string>('');

  // Marcas únicas de las solicitudes
  const allBrands = useMemo(() => [...new Set(solicitudes.map(s => s.brand).filter(Boolean))].sort(), [solicitudes]);

  // Solicitudes filtradas por fecha y marca
  const filtered = useMemo(() => {
    const threshold = getDateThreshold(dateRange);
    return solicitudes.filter(s => {
      const d = new Date(s.createdAt);
      const matchDate = d >= threshold;
      const matchBrand = !brandFilter || s.brand === brandFilter;
      return matchDate && matchBrand;
    });
  }, [solicitudes, dateRange, brandFilter]);

  // Stats
  const total = filtered.length;
  const sinComentarios = filtered.filter(s => s.status === 'APROBADA').length;
  const conComentarios = filtered.filter(s => s.status === 'APROBADA_OBSERVACIONES').length;
  const rechazadas = filtered.filter(s => s.status === 'RECHAZADA').length;
  const enRevision = filtered.filter(s => s.status === 'EN_REVISION').length;
  const publicadas = filtered.filter(s => s.status === 'PUBLICADA').length;
  const pendientes = filtered.filter(s => !['APROBADA', 'APROBADA_OBSERVACIONES', 'RECHAZADA', 'PUBLICADA'].includes(s.status)).length;
  void pendientes; // usado en cálculos futuros

  // Piezas por marca
  const brandData = useMemo(() => {
    const counts: Record<string, { total: number; sinComentarios: number; conComentarios: number; rechazadas: number }> = {};
    filtered.forEach(s => {
      const b = s.brand || 'Sin marca';
      if (!counts[b]) counts[b] = { total: 0, sinComentarios: 0, conComentarios: 0, rechazadas: 0 };
      counts[b].total++;
      if (s.status === 'APROBADA') counts[b].sinComentarios++;
      if (s.status === 'APROBADA_OBSERVACIONES') counts[b].conComentarios++;
      if (s.status === 'RECHAZADA') counts[b].rechazadas++;
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Tendencia mensual (últimos 6 meses o según rango)
  const trendData = useMemo(() => {
    const months: Record<string, { creadas: number; revisadas: number; rechazadas: number }> = {};
    filtered.forEach(s => {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
      void label;
      if (!months[key]) months[key] = { creadas: 0, revisadas: 0, rechazadas: 0 };
      months[key].creadas++;
      if (['APROBADA', 'APROBADA_OBSERVACIONES', 'PUBLICADA'].includes(s.status)) months[key].revisadas++;
      if (s.status === 'RECHAZADA') months[key].rechazadas++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [y, m] = key.split('-');
        const d = new Date(parseInt(y), parseInt(m) - 1);
        return { name: d.toLocaleDateString('es-CO', { month: 'short' }), ...data };
      });
  }, [filtered]);

  // Pie de distribución por estado
  const pieData = useMemo(() => [
    { name: 'Sin comentarios', value: sinComentarios, color: '#10b981' },
    { name: 'Con comentarios', value: conComentarios, color: '#0ea5e9' },
    { name: 'Rechazadas', value: rechazadas, color: '#ef4444' },
    { name: 'En revisión', value: enRevision, color: '#f59e0b' },
    { name: 'Publicadas', value: publicadas, color: '#8b5cf6' },
  ].filter(d => d.value > 0), [sinComentarios, conComentarios, rechazadas, enRevision, publicadas]);

  // Tiempo promedio de revisión (días)
  const avgDays = useMemo(() => {
    const reviewed = filtered.filter(s => ['APROBADA', 'APROBADA_OBSERVACIONES', 'RECHAZADA'].includes(s.status));
    if (reviewed.length === 0) return 0;
    const totalDays = reviewed.reduce((sum, s) => {
      const created = new Date(s.createdAt).getTime();
      const updated = new Date(s.updatedAt || s.createdAt).getTime();
      return sum + (updated - created) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(totalDays / reviewed.length);
  }, [filtered]);

  const recientes = useMemo(() =>
    [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5),
  [filtered]);

  const stats = [
    { label: 'Total piezas', value: total, icon: FileText, color: 'text-[#1e3a5f]', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100' },
    { label: 'Sin comentarios', value: sinComentarios, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100' },
    { label: 'Con comentarios', value: conComentarios, icon: MessageSquare, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-100' },
    { label: 'Rechazadas', value: rechazadas, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100' },
    { label: 'En revisión', value: enRevision, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100' },
    { label: 'Días prom. revisión', value: avgDays, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Hola {user?.name} — resumen de actividad del comité</p>
        </div>
        {hasPermission(user?.role || '', 'crear_solicitud') && (
          scheduleCheck.allowed ? (
            <Link to="/solicitudes/nueva"><Button className="gap-2"><PlusCircle size={18} />Nueva Solicitud</Button></Link>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-500 max-w-[200px] text-right">{scheduleCheck.message}</span>
              <Button className="gap-2" disabled><PlusCircle size={18} />Nueva Solicitud</Button>
            </div>
          )
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold"><Calendar size={14} /> Período:</div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {DATE_RANGES.map(r => (
            <button key={r.value} onClick={() => setDateRange(r.value)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                dateRange === r.value ? 'bg-white dark:bg-slate-700 text-[#1e3a5f] shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold ml-2"><Filter size={14} /> Marca:</div>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
          className="text-xs h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 min-w-[140px]">
          <option value="">Todas las marcas</option>
          {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {(brandFilter || dateRange !== 'mes') && (
          <button onClick={() => { setBrandFilter(''); setDateRange('mes'); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline">Limpiar filtros</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 size={24} className="animate-spin" /> Cargando datos...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat, i) => (
              <Card key={i} className={cn('border', stat.border)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', stat.bg)}><stat.icon size={18} className={stat.color} /></div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tendencia mensual */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#1e3a5f]" /> Tendencia de piezas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendData.length > 0 ? (
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="colorCreadas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorRevisadas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="creadas" name="Creadas" stroke="#1e3a5f" strokeWidth={2} fill="url(#colorCreadas)" />
                          <Area type="monotone" dataKey="revisadas" name="Revisadas" stroke="#10b981" strokeWidth={2} fill="url(#colorRevisadas)" />
                          <Area type="monotone" dataKey="rechazadas" name="Rechazadas" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center py-12 text-slate-400 text-sm">Sin datos para el período seleccionado</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Distribución por estado */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Distribución por resultado</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(value: any) => [`${value} piezas`, '']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-2">
                      {pieData.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-center py-12 text-slate-400 text-sm">Sin datos</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Piezas por marca + Recientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Piezas por marca */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Piezas por marca</CardTitle>
              </CardHeader>
              <CardContent>
                {brandData.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={brandData} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={100} />
                        <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="sinComentarios" name="Sin comentarios" fill="#10b981" radius={[0, 4, 4, 0]} stackId="a" />
                        <Bar dataKey="conComentarios" name="Con comentarios" fill="#0ea5e9" radius={[0, 0, 0, 0]} stackId="a" />
                        <Bar dataKey="rechazadas" name="Rechazadas" fill="#ef4444" radius={[0, 4, 4, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center py-12 text-slate-400 text-sm">Sin datos</p>
                )}
              </CardContent>
            </Card>

            {/* Solicitudes recientes */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">Solicitudes recientes</CardTitle>
                <Link to="/solicitudes"><Button variant="ghost" size="sm" className="text-[#1e3a5f] text-xs">Ver todas</Button></Link>
              </CardHeader>
              <CardContent>
                {recientes.length === 0 ? (
                  <p className="text-center py-12 text-slate-400 text-sm">No hay solicitudes en este período</p>
                ) : (
                  <div className="space-y-2">
                    {recientes.map(s => (
                      <Link key={s.id} to={`/solicitudes/${s.id}`}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: BRAND_COLORS[s.brand] || '#64748b' }}>
                            {s.brand?.[0] || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{s.title}</p>
                            <p className="text-[10px] text-slate-400">{s.consecutive} · {formatDate(s.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={cn('text-[9px] px-1.5', STATUS_LABELS[s.status]?.color || '')}>
                            {STATUS_LABELS[s.status]?.label || s.status}
                          </Badge>
                          <ArrowRight size={14} className="text-slate-300" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resumen rápido por marca (chips) */}
          {!brandFilter && allBrands.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Resumen por marca</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {brandData.map(b => (
                    <button key={b.name} onClick={() => setBrandFilter(b.name)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#1e3a5f] hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all text-xs">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND_COLORS[b.name] || '#64748b' }} />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{b.name}</span>
                      <span className="text-slate-400 font-bold">{b.total}</span>
                      {b.sinComentarios > 0 && <span className="text-emerald-600">✓{b.sinComentarios}</span>}
                      {b.rechazadas > 0 && <span className="text-red-500">✗{b.rechazadas}</span>}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardPage;
