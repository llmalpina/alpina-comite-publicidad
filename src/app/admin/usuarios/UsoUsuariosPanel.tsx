import React, { useMemo } from 'react';
import { Users, LogIn, Activity, UserCheck, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useConfig } from '../../../contexts/ConfigContext';
import { cn } from '../../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

/** Usuario tal como lo entrega GET /usuarios (con métricas de uso opcionales). */
export interface UsageUser {
  id: string;
  name: string;
  email: string;
  role: string;
  area: string;
  activo: boolean;
  createdAt: string;
  lastLogin?: string;
  loginCount?: number;
}

const ROLE_CHART_COLORS = ['#1e3a5f', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'];

/** Devuelve un texto relativo tipo "hace 3 días" a partir de una fecha ISO. */
function timeAgo(iso?: string): string {
  if (!iso) return 'Sin registro';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Sin registro';
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${months} mes${months > 1 ? 'es' : ''}`;
  const years = Math.floor(months / 12);
  return `Hace ${years} año${years > 1 ? 's' : ''}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const UsoUsuariosPanel: React.FC<{ users: UsageUser[] }> = ({ users }) => {
  const { roles } = useConfig();

  const roleLabel = (id: string) => roles.find(r => r.id === id)?.label || id;

  const metrics = useMemo(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const activos = users.filter(u => u.activo).length;
    const inactivos = users.length - activos;
    const totalIngresos = users.reduce((acc, u) => acc + (u.loginCount || 0), 0);
    const conRegistro = users.filter(u => u.lastLogin).length;
    const activos7d = users.filter(u => u.lastLogin && now - new Date(u.lastLogin).getTime() <= 7 * DAY).length;
    const activos30d = users.filter(u => u.lastLogin && now - new Date(u.lastLogin).getTime() <= 30 * DAY).length;
    const nuncaIngresaron = users.filter(u => !u.lastLogin).length;

    return { activos, inactivos, totalIngresos, conRegistro, activos7d, activos30d, nuncaIngresaron };
  }, [users]);

  // Ranking: quién más ha ingresado (top 10 por loginCount)
  const topIngresos = useMemo(() => {
    return users
      .filter(u => (u.loginCount || 0) > 0)
      .sort((a, b) => (b.loginCount || 0) - (a.loginCount || 0))
      .slice(0, 10)
      .map(u => ({ name: u.name || u.email, ingresos: u.loginCount || 0 }));
  }, [users]);

  // Última vez activo: ordenado por lastLogin desc (los sin registro al final)
  const porActividad = useMemo(() => {
    return [...users].sort((a, b) => {
      const ta = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
      const tb = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
      return tb - ta;
    });
  }, [users]);

  // Distribución por rol
  const porRol = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
    return Object.entries(counts)
      .map(([role, value]) => ({ name: roleLabel(role), value }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, roles]);

  const kpis = [
    { label: 'Usuarios activos', value: metrics.activos, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100' },
    { label: 'Total ingresos', value: metrics.totalIngresos, icon: LogIn, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-100' },
    { label: 'Activos últimos 7 días', value: metrics.activos7d, icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-100' },
    { label: 'Activos últimos 30 días', value: metrics.activos30d, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100' },
    { label: 'Nunca han ingresado', value: metrics.nuncaIngresaron, icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800/40', border: 'border-slate-100' },
    { label: 'Total usuarios', value: users.length, icon: Users, color: 'text-[#1e3a5f]', bg: 'bg-slate-50 dark:bg-slate-800/40', border: 'border-slate-100' },
  ];

  return (
    <div className="space-y-6">
      {metrics.conRegistro === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Aún no hay registros de ingreso. El seguimiento de uso empieza a acumularse a partir de que los usuarios inicien sesión tras el despliegue del backend. Mientras tanto, la distribución por rol y la antigüedad de las cuentas ya reflejan datos reales.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <Card key={i} className={cn('border', kpi.border)}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={cn('p-1.5 sm:p-2 rounded-lg shrink-0', kpi.bg)}><kpi.icon size={16} className={kpi.color} /></div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{kpi.value}</p>
                  <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking de ingresos */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp size={16} className="text-[#1e3a5f]" /> Quién más ha ingresado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topIngresos.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topIngresos} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={140} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v: any) => [`${v} ingresos`, '']} />
                      <Bar dataKey="ingresos" name="Ingresos" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center py-12 text-slate-400 text-sm">Aún no hay ingresos registrados.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Distribución por rol */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Distribución por rol</CardTitle>
          </CardHeader>
          <CardContent>
            {porRol.length > 0 ? (
              <>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={porRol} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                        {porRol.map((_, i) => <Cell key={i} fill={ROLE_CHART_COLORS[i % ROLE_CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`${value} usuarios`, '']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {porRol.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ROLE_CHART_COLORS[i % ROLE_CHART_COLORS.length] }} />
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

      {/* Última vez activo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock size={16} className="text-[#1e3a5f]" /> Última vez activo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b">
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rol</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ingresos</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Último acceso</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hace</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {porActividad.map(u => (
                  <tr key={u.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors', !u.activo && 'opacity-50')}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {(u.name || u.email)?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{u.name || u.email}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className="bg-slate-100 text-slate-700">{roleLabel(u.role)}</Badge>
                    </td>
                    <td className="p-4 text-sm font-semibold text-slate-900 dark:text-white">{u.loginCount || 0}</td>
                    <td className="p-4 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(u.lastLogin)}</td>
                    <td className="p-4">
                      <span className={cn('text-xs font-medium', u.lastLogin ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400')}>
                        {timeAgo(u.lastLogin)}
                      </span>
                    </td>
                  </tr>
                ))}
                {porActividad.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-16 text-slate-400 text-sm">No hay usuarios.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsoUsuariosPanel;
