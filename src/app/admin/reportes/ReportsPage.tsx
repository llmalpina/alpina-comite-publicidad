import React from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Download, Calendar } from 'lucide-react';

const ReportsPage: React.FC = () => {
  const weeklyData = [
    { name: 'Sem 1', piezas: 45, tiempo: 24 },
    { name: 'Sem 2', piezas: 52, tiempo: 22 },
    { name: 'Sem 3', piezas: 48, tiempo: 28 },
    { name: 'Sem 4', piezas: 61, tiempo: 20 },
    { name: 'Sem 5', piezas: 55, tiempo: 18 },
    { name: 'Sem 6', piezas: 67, tiempo: 15 },
  ];

  const areaData = [
    { name: 'Bon Yurt', value: 35 },
    { name: 'Alpina', value: 25 },
    { name: 'Finesse', value: 15 },
    { name: 'Yox', value: 12 },
    { name: 'Otros', value: 13 },
  ];

  const COLORS = ['#1450C9', '#241F48', '#3b82f6', '#60a5fa', '#D9EEF9'];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reportes y Métricas</h1>
          <p className="text-slate-500 dark:text-slate-400">Analiza el desempeño y eficiencia del comité.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Calendar size={18} />
            Últimos 30 días
          </Button>
          <Button className="gap-2">
            <Download size={18} />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tiempo Promedio Revisión</p>
            <h3 className="text-3xl font-black text-brand mt-1">18.5 <span className="text-sm font-normal text-slate-500 dark:text-slate-400">horas</span></h3>
            <p className="text-xs text-emerald-600 mt-2 font-bold">↓ 12% vs mes anterior</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tasa de Aprobación</p>
            <h3 className="text-3xl font-black text-brand mt-1">82.4 <span className="text-sm font-normal text-slate-500 dark:text-slate-400">%</span></h3>
            <p className="text-xs text-emerald-600 mt-2 font-bold">↑ 5% vs mes anterior</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tasa de Reproceso</p>
            <h3 className="text-3xl font-black text-brand mt-1">15.2 <span className="text-sm font-normal text-slate-500 dark:text-slate-400">%</span></h3>
            <p className="text-xs text-red-600 mt-2 font-bold">↑ 2% vs mes anterior</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Volumen de Piezas vs Tiempo de Respuesta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="piezas" stroke="#1450C9" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} name="Piezas Recibidas" />
                  <Line yAxisId="right" type="monotone" dataKey="tiempo" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Tiempo Promedio (h)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Distribución por Marca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={areaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {areaData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold">Motivos de Rechazo más Frecuentes</CardTitle>
          <Button variant="ghost" size="sm" className="text-blue-600">Ver detalles</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { motivo: 'Falta de sellos frontales (Ley 2120)', count: 42, color: 'bg-red-500' },
              { motivo: 'Claims nutricionales sin sustento', count: 28, color: 'bg-red-400' },
              { motivo: 'Uso incorrecto de marca / logo', count: 15, color: 'bg-red-300' },
              { motivo: 'Información legal incompleta / ilegible', count: 10, color: 'bg-red-200' },
              { motivo: 'Otros', count: 5, color: 'bg-red-100' },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{item.motivo}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.count}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.count}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
