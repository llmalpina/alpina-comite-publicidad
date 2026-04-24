import React, { useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Calendar, Clock, FileText, CheckCircle2, XCircle, TrendingUp, Filter, Send, Loader2 } from 'lucide-react';
import { useSolicitudes } from '../../../hooks/useSolicitudes';
import { useMaestros } from '../../../contexts/MaestrosContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { cn, formatDate } from '../../../lib/utils';
import { Input } from '../../../components/ui/Input';
import { comentariosApi } from '../../../lib/api';

type Periodo = 'semana' | 'mes' | 'trimestre' | 'anio';

const ReportsPage: React.FC = () => {
  const { solicitudes } = useSolicitudes();
  const { config } = useMaestros();
  const [periodo, setPeriodo] = useState<Periodo>('mes');

  const threshold = useMemo(() => {
    const now = new Date();
    switch (periodo) {
      case 'semana': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
      case 'mes': return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'trimestre': return new Date(now.getFullYear(), now.getMonth() - 3, 1);
      case 'anio': return new Date(now.getFullYear(), 0, 1);
    }
  }, [periodo]);

  const filtered = useMemo(() => solicitudes.filter(s => new Date(s.createdAt) >= threshold), [solicitudes, threshold]);

  // Mapa de minutos por tipo
  const minutosMap = useMemo(() => {
    const m: Record<string, number> = {};
    config.tiposContenido.forEach(t => { m[t.value] = (t as any).minutos || 40; });
    return m;
  }, [config]);

  // KPIs
  const total = filtered.length;
  const sinComentarios = filtered.filter(s => s.status === 'APROBADA').length;
  const conComentarios = filtered.filter(s => s.status === 'APROBADA_OBSERVACIONES').length;
  const rechazadas = filtered.filter(s => s.status === 'RECHAZADA').length;
  const publicadas = filtered.filter(s => s.status === 'PUBLICADA').length;
  const tasaAprobacion = total > 0 ? Math.round(((sinComentarios + conComentarios + publicadas) / total) * 100) : 0;
  const tasaRechazo = total > 0 ? Math.round((rechazadas / total) * 100) : 0;

  // Horas consumidas
  const horasConsumidas = useMemo(() => {
    let totalMin = 0;
    filtered.forEach(s => { totalMin += minutosMap[s.contentType] || 40; });
    return Math.round(totalMin / 60 * 10) / 10;
  }, [filtered, minutosMap]);

  // Tiempo promedio de revisión (días)
  const tiempoPromedio = useMemo(() => {
    const reviewed = filtered.filter(s => ['APROBADA', 'APROBADA_OBSERVACIONES', 'RECHAZADA'].includes(s.status));
    if (reviewed.length === 0) return 0;
    const totalDays = reviewed.reduce((sum, s) => {
      return sum + (new Date(s.updatedAt || s.createdAt).getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(totalDays / reviewed.length * 10) / 10;
  }, [filtered]);

  // Horas por tipo de contenido
  const horasPorTipo = useMemo(() => {
    const counts: Record<string, { count: number; minutos: number }> = {};
    filtered.forEach(s => {
      const t = s.contentType;
      if (!counts[t]) counts[t] = { count: 0, minutos: 0 };
      counts[t].count++;
      counts[t].minutos += minutosMap[t] || 40;
    });
    return Object.entries(counts).map(([tipo, data]) => {
      const info = config.tiposContenido.find(t => t.value === tipo);
      return { name: info?.label || tipo, piezas: data.count, horas: Math.round(data.minutos / 60 * 10) / 10 };
    }).sort((a, b) => b.horas - a.horas);
  }, [filtered, minutosMap, config]);

  // Distribución por marca
  const porMarca = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => { counts[s.brand] = (counts[s.brand] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filtered]);

  // Distribución por estado
  const porEstado = useMemo(() => [
    { name: 'Sin comentarios', value: sinComentarios, color: '#10b981' },
    { name: 'Con comentarios', value: conComentarios, color: '#0ea5e9' },
    { name: 'Rechazadas', value: rechazadas, color: '#ef4444' },
    { name: 'Publicadas', value: publicadas, color: '#8b5cf6' },
    { name: 'En proceso', value: total - sinComentarios - conComentarios - rechazadas - publicadas, color: '#f59e0b' },
  ].filter(d => d.value > 0), [sinComentarios, conComentarios, rechazadas, publicadas, total]);

  const COLORS = ['#1e3a5f', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#64748b'];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reportes y Métricas</h1>
          <p className="text-slate-500 dark:text-slate-400">Datos reales del comité de publicidad.</p>
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {([
            { v: 'semana' as Periodo, l: 'Semana' },
            { v: 'mes' as Periodo, l: 'Mes' },
            { v: 'trimestre' as Periodo, l: 'Trimestre' },
            { v: 'anio' as Periodo, l: 'Año' },
          ]).map(p => (
            <button key={p.v} onClick={() => setPeriodo(p.v)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                periodo === p.v ? 'bg-white dark:bg-slate-700 text-[#1e3a5f] shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total piezas', value: total, icon: FileText, color: 'text-[#1e3a5f]', bg: 'bg-blue-50' },
          { label: 'Horas consumidas', value: `${horasConsumidas}h`, icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Días prom. revisión', value: tiempoPromedio, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Tasa revisión OK', value: `${tasaAprobacion}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Tasa rechazo', value: `${tasaRechazo}%`, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Publicadas', value: publicadas, icon: Filter, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={cn('p-1.5 sm:p-2 rounded-lg shrink-0', s.bg)}><s.icon size={16} className={s.color} /></div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{s.value}</p>
                  <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horas por tipo de contenido */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2"><Clock size={16} /> Horas de revisión por tipo de contenido</CardTitle>
          </CardHeader>
          <CardContent>
            {horasPorTipo.length > 0 ? (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={horasPorTipo} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={160} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="horas" name="Horas" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="piezas" name="Piezas" fill="#93c5fd" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-center py-12 text-slate-400 text-sm">Sin datos</p>}
          </CardContent>
        </Card>

        {/* Distribución por estado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Distribución por resultado</CardTitle>
          </CardHeader>
          <CardContent>
            {porEstado.length > 0 ? (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={porEstado} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                        {porEstado.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${v} piezas`, '']} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {porEstado.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-900">{item.value} ({total > 0 ? Math.round(item.value / total * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-center py-12 text-slate-400 text-sm">Sin datos</p>}
          </CardContent>
        </Card>
      </div>

      {/* Distribución por marca */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Piezas por marca</CardTitle>
        </CardHeader>
        <CardContent>
          {porMarca.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMarca}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', fontSize: 12 }} />
                  <Bar dataKey="value" name="Piezas" radius={[4, 4, 0, 0]}>
                    {porMarca.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-center py-12 text-slate-400 text-sm">Sin datos</p>}
        </CardContent>
      </Card>

      {/* Tabla de horas por tipo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2"><Clock size={16} /> Detalle de horas por tipo de contenido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 text-xs font-bold text-slate-500 uppercase">Tipo de solicitud</th>
                <th className="pb-2 text-xs font-bold text-slate-500 uppercase text-center">Min/pieza</th>
                <th className="pb-2 text-xs font-bold text-slate-500 uppercase text-center">Piezas</th>
                <th className="pb-2 text-xs font-bold text-slate-500 uppercase text-center">Horas</th>
                <th className="pb-2 text-xs font-bold text-slate-500 uppercase text-center">Esperado/sem</th>
              </tr>
            </thead>
            <tbody>
              {config.tiposContenido.filter(t => t.activo).map(tipo => {
                const count = filtered.filter(s => s.contentType === tipo.value).length;
                const min = (tipo as any).minutos || 40;
                const horas = Math.round(count * min / 60 * 10) / 10;
                const esperado = (tipo as any).contenidosSemana || 0;
                return (
                  <tr key={tipo.id} className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-700 dark:text-slate-300">{tipo.label}</td>
                    <td className="py-2.5 text-center font-semibold">{min}</td>
                    <td className="py-2.5 text-center font-semibold">{count}</td>
                    <td className="py-2.5 text-center font-bold text-[#1e3a5f]">{horas}h</td>
                    <td className="py-2.5 text-center text-slate-400">{esperado}/sem</td>
                  </tr>
                );
              })}
              <tr className="font-bold bg-slate-50 dark:bg-slate-800">
                <td className="py-2.5">Total</td>
                <td className="py-2.5 text-center">—</td>
                <td className="py-2.5 text-center">{total}</td>
                <td className="py-2.5 text-center text-[#1e3a5f]">{horasConsumidas}h</td>
                <td className="py-2.5 text-center text-slate-400">—</td>
              </tr>
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      {/* Informe semanal para gerencia */}
      <InformeSemanal solicitudes={filtered} />
    </div>
  );
};

// ─── Componente Informe Semanal ───────────────────────────────────────────────
const InformeSemanal: React.FC<{ solicitudes: any[] }> = ({ solicitudes }) => {
  const { notify } = useNotifications();
  const { emailConfig } = useConfig();
  // Obtener destinatarios de la regla de informe
  const informeRule = emailConfig.rules.find(r => r.event === 'informe_semanal' || r.label?.toLowerCase().includes('informe'));
  const defaultEmails = informeRule?.toEmails?.length ? informeRule.toEmails : ['nicolas.carreno@alpina.com'];
  const defaultCc = informeRule?.cc || [];

  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [sending, setSending] = useState(false);
  const [topN, setTopN] = useState(10);
  const [emailTo, setEmailTo] = useState(defaultEmails.join(', '));
  const [comentariosDestacados, setComentariosDestacados] = useState<Record<string, any[]>>({});

  const piezasInforme = useMemo(() => {
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin + 'T23:59:59');
    return solicitudes
      .filter(s => ['APROBADA', 'APROBADA_OBSERVACIONES', 'RECHAZADA', 'EN_REVISION'].includes(s.status))
      .filter(s => {
        // Usa la fecha de revisión del comité (la más reciente entre ARA y Legal)
        const araDate = (s as any).approvalARA?.at;
        const legalDate = (s as any).approvalLegal?.at;
        const reviewDate = araDate && legalDate
          ? (araDate > legalDate ? araDate : legalDate)
          : araDate || legalDate || s.updatedAt || s.createdAt;
        const d = new Date(reviewDate);
        return d >= start && d <= end;
      })
      .sort((a, b) => {
        const prio: Record<string, number> = { red: 0, yellow: 1, green: 2 };
        return (prio[a.priority] ?? 3) - (prio[b.priority] ?? 3);
      })
      .slice(0, topN);
  }, [solicitudes, fechaInicio, fechaFin, topN]);

  // Cargar comentarios y anotaciones destacadas para el preview
  React.useEffect(() => {
    const loadHighlighted = async () => {
      const result: Record<string, any[]> = {};
      for (const s of piezasInforme) {
        try {
          const [comments, annotations] = await Promise.all([
            comentariosApi.list(s.id).catch(() => []),
            fetch(`${(import.meta as any).env?.VITE_API_URL}/solicitudes/${s.id}/anotaciones`, {
              headers: { ...(localStorage.getItem('alpina_id_token') ? { Authorization: `Bearer ${localStorage.getItem('alpina_id_token')}` } : {}) },
            }).then(r => r.json()).catch(() => []),
          ]);
          const highlighted = [...(comments || []), ...(annotations || [])].filter((c: any) => c.highlighted);
          if (highlighted.length > 0) result[s.id] = highlighted;
        } catch {}
      }
      setComentariosDestacados(result);
    };
    if (piezasInforme.length > 0) loadHighlighted();
  }, [piezasInforme]);

  const prioColors: Record<string, string> = { red: 'bg-red-500', yellow: 'bg-yellow-400', green: 'bg-emerald-500' };
  const prioLabels: Record<string, string> = { red: 'Urgente', yellow: 'Media', green: 'Normal' };
  const statusLabels: Record<string, string> = { APROBADA: 'Sin comentarios', APROBADA_OBSERVACIONES: 'Con comentarios', RECHAZADA: 'Rechazada', EN_REVISION: 'En revisión' };

  const handleSend = async () => {
    setSending(true);
    try {
      const sesUrl = (import.meta as any).env?.VITE_SES_LAMBDA_URL as string;
      const apiUrl = (import.meta as any).env?.VITE_API_URL as string;
      const token = localStorage.getItem('alpina_id_token');
      // Obtener comentarios destacados para cada pieza
      const piezasConComentarios = await Promise.all(piezasInforme.map(async (s) => {
        let highlightedComments: any[] = [];
        try {
          const comments = await comentariosApi.list(s.id);
          highlightedComments = (comments || []).filter((c: any) => c.highlighted);
        } catch {}
        return { id: s.id, title: s.title, consecutive: s.consecutive, brand: s.brand, status: s.status, priority: s.priority, description: s.description, highlightedComments };
      }));
      await fetch(sesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ template: 'informe_semanal', to: emailTo.split(',').map(e => e.trim()).filter(Boolean), cc: defaultCc, data: { piezas: piezasConComentarios } }),
      });
      notify('Informe enviado por correo', 'success');
    } catch (e: any) { notify(e.message || 'Error al enviar', 'error'); }
    finally { setSending(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2"><FileText size={16} /> Informe semanal para gerencia</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-8 text-xs w-36" />
          <span className="text-xs text-slate-400">a</span>
          <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="h-8 text-xs w-36" />
          <Input type="number" min={1} max={50} value={topN} onChange={e => setTopN(parseInt(e.target.value) || 10)} className="h-8 text-xs w-16" title="Top N" />
          <Input type="text" value={emailTo} onChange={e => setEmailTo(e.target.value)} className="h-8 text-xs w-48" placeholder="correo@alpina.com" title="Destinatarios (separados por coma)" />
          <Button size="sm" onClick={handleSend} disabled={sending || piezasInforme.length === 0} className="gap-1 shrink-0">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Enviando...' : 'Enviar informe'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {piezasInforme.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No hay piezas revisadas en este período</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{piezasInforme.length} pieza{piezasInforme.length > 1 ? 's' : ''} revisada{piezasInforme.length > 1 ? 's' : ''} — ordenadas por prioridad</p>
            {piezasInforme.map((s, i) => (
              <div key={s.id} className={cn('p-4 rounded-lg border', s.priority === 'red' ? 'bg-red-50 border-red-200' : s.priority === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200')}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                    <div className={cn('w-3 h-3 rounded-full', prioColors[s.priority] || 'bg-slate-300')} />
                    <span className="text-xs font-semibold text-slate-500">{prioLabels[s.priority] || 'Sin prioridad'}</span>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                    s.status === 'RECHAZADA' ? 'bg-red-100 text-red-700' : s.status === 'APROBADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                    {statusLabels[s.status] || s.status}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800">{s.title}</p>
                <p className="text-[10px] text-slate-500">{s.consecutive} · {s.brand} · {formatDate(s.updatedAt || s.createdAt)}</p>
                {s.description && <p className="text-xs text-slate-600 mt-1 italic">"{s.description}"</p>}
                {/* Comentarios/anotaciones destacadas */}
                {comentariosDestacados[s.id]?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Comentarios destacados:</p>
                    {comentariosDestacados[s.id].map((c: any, j: number) => (
                      <div key={j} className="flex gap-2 text-xs">
                        <span className="text-yellow-500">★</span>
                        <div>
                          <span className="font-semibold text-slate-700">{c.userName}</span>
                          <span className="text-slate-400 ml-1">{c.area}</span>
                          <p className="text-slate-600">{c.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportsPage;
