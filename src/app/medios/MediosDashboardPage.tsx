import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Inbox, LayoutGrid, Loader2, Play, RefreshCw, PackageOpen } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../lib/utils';
import { useNotifications } from '../../contexts/NotificationContext';
import { mediosApi, type MedioDisponible } from '../../lib/medios-api';
import type { MedioCampana } from '../../types/medios';
import { MEDIO_ESTADO_LABELS } from '../../types/medios';

type Tab = 'DISPONIBLES' | 'CAMPANAS';

/**
 * Dashboard del módulo de Medios — Cuadro de Materiales & QA Audiovisual.
 * FASE 2: flujo de inicio. Dos pestañas:
 *   - Disponibles: piezas PUBLICADAS por el comité, aún sin iniciar en Medios.
 *   - Campañas: las ya iniciadas (cabeceras). El detalle/líneas/QA llegan después.
 * Acceso solo-ADMIN (gate en App.tsx + Sidebar; backend valida ADMIN).
 */
const MediosDashboardPage: React.FC = () => {
  const { notify } = useNotifications();
  const [tab, setTab] = useState<Tab>('DISPONIBLES');
  const [loading, setLoading] = useState(true);
  const [disponibles, setDisponibles] = useState<MedioDisponible[]>([]);
  const [campanas, setCampanas] = useState<MedioCampana[]>([]);
  const [iniciando, setIniciando] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const [disp, camp] = await Promise.all([
        mediosApi.disponibles().catch(() => []),
        mediosApi.listCampanas().catch(() => []),
      ]);
      setDisponibles(disp);
      setCampanas(camp);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const iniciar = async (d: MedioDisponible) => {
    setIniciando(d.solicitudId);
    try {
      await mediosApi.iniciarCampana(d.solicitudId);
      notify(`"${d.title}" se inició en Medios`, 'success');
      await cargar();
      setTab('CAMPANAS');
    } catch (e: any) {
      notify(e.message || 'No se pudo iniciar en Medios', 'error');
    } finally {
      setIniciando(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Film className="text-violet-600 dark:text-violet-400" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Medios · Cuadro de Materiales</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Piezas liberadas por el comité, listas para producción y QA.</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={cargar} title="Actualizar" className="text-slate-400 hover:text-slate-600">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        {([
          { key: 'DISPONIBLES', label: 'Disponibles', icon: Inbox, count: disponibles.length },
          { key: 'CAMPANAS', label: 'Campañas', icon: LayoutGrid, count: campanas.length },
        ] as { key: Tab; label: string; icon: any; count: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${
              tab === t.key ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <t.icon size={14} /> {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mr-2" size={20} /> Cargando…
        </div>
      ) : tab === 'DISPONIBLES' ? (
        disponibles.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No hay piezas disponibles"
            text="Cuando el comité publique una pieza, aparecerá aquí para iniciarla en Medios."
          />
        ) : (
          <div className="space-y-3">
            {disponibles.map(d => (
              <Card key={d.solicitudId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{d.title}</p>
                      <Badge className="bg-violet-100 text-violet-700 text-[10px]">Publicada</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {d.consecutive} · {d.marca}{d.producto ? ` · ${d.producto}` : ''} · {d.numeroPiezas || 0} pieza(s)
                    </p>
                    <p className="text-[10px] text-slate-400">Publicada el {formatDate(d.publishedAt)}</p>
                  </div>
                  <Button size="sm" className="gap-1 shrink-0" disabled={iniciando === d.solicitudId} onClick={() => iniciar(d)}>
                    {iniciando === d.solicitudId ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Iniciar en Medios
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : campanas.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Sin campañas iniciadas"
          text="Inicia una pieza desde la pestaña Disponibles para crear su campaña de materiales."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campanas.map(c => {
            const estado = MEDIO_ESTADO_LABELS[c.estadoAgregado] || MEDIO_ESTADO_LABELS.PENDIENTE;
            return (
              <Link key={c.campaignId} to={`/medios/campanas/${c.campaignId}`} className="block">
                <Card className="hover:shadow-md hover:border-violet-200 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{c.title}</p>
                      <Badge className={estado.color + ' text-[10px] shrink-0'}>{estado.label}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{c.consecutive} · {c.marca}</p>
                    <p className="text-[10px] text-slate-400 mt-2">{c.totalPiezas || 0} línea(s) · iniciada {formatDate(c.createdAt)}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ icon: any; title: string; text: string }> = ({ icon: Icon, title, text }) => (
  <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
    <Icon size={40} className="mx-auto text-slate-300 mb-3" />
    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{text}</p>
  </div>
);

export default MediosDashboardPage;
