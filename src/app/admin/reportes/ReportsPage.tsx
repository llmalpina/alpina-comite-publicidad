import React, { useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Calendar, Clock, FileText, CheckCircle2, XCircle, TrendingUp, Filter } from 'lucide-react';
import { useSolicitudes } from '../../../hooks/useSolicitudes';
import { useMaestros } from '../../../contexts/MaestrosContext';
import { cn } from '../../../lib/utils';

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
    </div>
  );
};

export default ReportsPage;
