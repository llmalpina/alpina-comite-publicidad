import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Film, Inbox, LayoutGrid, Loader2, Plus, RefreshCw, PackageOpen, Settings, FileText } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../lib/utils';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { mediosApi, type MedioDisponible, type MedioResumen, type MedioResumenCampana } from '../../lib/medios-api';
import type { MedioCampana } from '../../types/medios';
import { useMediosConfig } from './hooks/useMediosConfig';
import Breadcrumb from './components/Breadcrumb';
import NivelCards, { type NivelCardItem } from './components/NivelCards';
import Termometro from './components/Termometro';
import ConfigCanchasModal from './components/ConfigCanchasModal';
import SpecsManagerModal from './components/SpecsManagerModal';
import CrearCampanaModal from './components/CrearCampanaModal';
import MultimarcaBadge from './components/MultimarcaBadge';

type Tab = 'JERARQUIA' | 'DISPONIBLES';
type Nivel = 'HOME' | 'CANCHA' | 'MARCA';

const SIN_ASIGNAR = 'SIN ASIGNAR';
const SIN_MARCA = 'SIN MARCA';

const emptyCampana = (): MedioResumenCampana => ({ total: 0, activas: 0, cargadas: 0, enQA: 0, implementadas: 0 });

/**
 * Dashboard del módulo de Medios. Contenedor de la jerarquía navegable
 * Canchas → Marcas → Campañas (deriva la agrupación en memoria de las campañas
 * + porCampana del resumen), con termómetro global y pestaña "Disponibles" para
 * iniciar campañas. Lee useSearchParams (nivel/cancha/marca) al montar. Solo-ADMIN.
 */
const MediosDashboardPage: React.FC = () => {
  const { notify } = useNotifications();
  const { user } = useAuth();
  const { hasPermission } = useConfig();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { config, reload: reloadConfig } = useMediosConfig();

  // Gating de acciones por permiso (ADMIN pasa siempre vía hasPermission).
  const puedeConfig = hasPermission(user?.role || '', 'medios_gestionar_config');
  const puedeIniciar = hasPermission(user?.role || '', 'medios_iniciar_campana');

  const [tab, setTab] = useState<Tab>('JERARQUIA');
  const [loading, setLoading] = useState(true);
  const [disponibles, setDisponibles] = useState<MedioDisponible[]>([]);
  const [campanas, setCampanas] = useState<MedioCampana[]>([]);
  const [resumen, setResumen] = useState<MedioResumen | null>(null);

  // Nivel de jerarquía derivado de la query string (RI-4). Un valor no vacío
  // pero inválido (p.ej. ?nivel=FOO) degrada a HOME, no a una vista en blanco.
  const nivelRaw = searchParams.get('nivel');
  const nivel: Nivel = nivelRaw === 'CANCHA' || nivelRaw === 'MARCA' ? nivelRaw : 'HOME';
  const canchaSel = searchParams.get('cancha') || '';
  const marcaSel = searchParams.get('marca') || '';

  const cargar = async () => {
    setLoading(true);
    try {
      const [disp, camp, res] = await Promise.all([
        mediosApi.disponibles().catch(() => []),
        mediosApi.listCampanas().catch(() => []),
        mediosApi.resumen().catch(() => null),
      ]);
      setDisponibles(disp);
      setCampanas(camp);
      setResumen(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const [configCanchasOpen, setConfigCanchasOpen] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [crearOpen, setCrearOpen] = useState(false);

  const goNivel = (next: Nivel, cancha?: string, marca?: string) => {
    const p: Record<string, string> = { nivel: next };
    if (cancha) p.cancha = cancha;
    if (marca) p.marca = marca;
    setSearchParams(p);
  };

  // ─── Agrupación en memoria de la jerarquía ────────────────────────────────────
  // Deriva la cancha: si la campaña no la trae explícita, se cruza su marca
  // (c.marca, elegida del maestro del comité) con la cancha asignada a esa marca
  // en config.taxonomia.marcas (comparación robusta: trim + case-insensitive).
  const marcasTax = config?.taxonomia?.marcas || [];
  const canchaDe = (c: MedioCampana) => {
    if (c.cancha && c.cancha.trim()) return c.cancha;
    const marca = (c.marca || '').trim().toUpperCase();
    if (marca) {
      const match = marcasTax.find(m => (m.nombre || '').trim().toUpperCase() === marca);
      if (match && match.cancha && match.cancha.trim()) return match.cancha;
    }
    return SIN_ASIGNAR;
  };
  // V2: una campaña puede tener múltiples marcas (multimarca). Agrupa esas campañas
  // bajo un nodo "Multimarca" en el nivel CANCHA; si trae una sola, usa esa marca.
  const MULTIMARCA = 'Multimarca';
  const marcaDe = (c: MedioCampana) => {
    const lista = (c.marcas && c.marcas.length ? c.marcas : (c.marca ? [c.marca] : [])).filter(m => m && m.trim());
    if (lista.length > 1) return MULTIMARCA;
    if (lista.length === 1) return lista[0];
    return SIN_MARCA;
  };
  const porCampana = resumen?.porCampana || {};

  const agg = (ids: string[]): MedioResumenCampana =>
    ids.reduce((acc, id) => {
      const r = porCampana[id] || emptyCampana();
      acc.total += r.total; acc.activas += r.activas; acc.cargadas += r.cargadas;
      acc.enQA += r.enQA; acc.implementadas += r.implementadas;
      return acc;
    }, emptyCampana());

  // Canchas con sus marcas y campañas.
  const canchasCards: NivelCardItem[] = useMemo(() => {
    const map = new Map<string, MedioCampana[]>();
    campanas.forEach(c => {
      const k = canchaDe(c);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cancha, camps]) => {
        const marcas = new Set(camps.map(marcaDe));
        const a = agg(camps.map(c => c.campaignId));
        return {
          key: cancha,
          title: cancha,
          activas: a.activas,
          implementadas: a.implementadas,
          hijos: marcas.size,
          hijosLabel: marcas.size === 1 ? 'marca' : 'marcas',
          onClick: () => goNivel('CANCHA', cancha),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanas, porCampana, marcasTax]);

  const marcasCards: NivelCardItem[] = useMemo(() => {
    const camps = campanas.filter(c => canchaDe(c) === canchaSel);
    const map = new Map<string, MedioCampana[]>();
    camps.forEach(c => {
      const k = marcaDe(c);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([marca, cs]) => {
        const a = agg(cs.map(c => c.campaignId));
        return {
          key: marca,
          title: marca,
          activas: a.activas,
          implementadas: a.implementadas,
          hijos: cs.length,
          hijosLabel: cs.length === 1 ? 'campaña' : 'campañas',
          onClick: () => goNivel('MARCA', canchaSel, marca),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanas, porCampana, canchaSel, marcasTax]);

  const campanasDeMarca = useMemo(
    () => campanas.filter(c => canchaDe(c) === canchaSel && marcaDe(c) === marcaSel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campanas, canchaSel, marcaSel, marcasTax],
  );

  const breadcrumb = [
    { label: 'Canchas', onClick: () => goNivel('HOME') },
    ...(nivel !== 'HOME' && canchaSel ? [{ label: canchaSel, onClick: () => goNivel('CANCHA', canchaSel) }] : []),
    ...(nivel === 'MARCA' && marcaSel ? [{ label: marcaSel }] : []),
  ];

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
        <div className="flex items-center gap-2">
          {config && puedeConfig && (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setConfigCanchasOpen(true)}>
                <Settings size={14} /> Canchas/Marcas
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setSpecsOpen(true)}>
                <FileText size={14} /> Specs
              </Button>
            </>
          )}
          {config && puedeIniciar && (
            <Button size="sm" className="gap-1" onClick={() => setCrearOpen(true)}>
              <Plus size={14} /> Nueva campaña
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={cargar} title="Actualizar" className="text-slate-400 hover:text-slate-600">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Termómetro global */}
      {resumen && resumen.total > 0 && (
        <Termometro data={resumen} titulo="📊 Termómetro global de cumplimiento" />
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        {([
          { key: 'JERARQUIA', label: 'Canchas', icon: LayoutGrid, count: canchasCards.length },
          { key: 'DISPONIBLES', label: 'Disponibles', icon: Inbox, count: disponibles.length },
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
          <EmptyState icon={PackageOpen} title="No hay piezas disponibles" text="Cuando el comité publique una pieza libre, aparecerá aquí para atarla a una campaña." />
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Piezas publicadas aún sin campaña. Crea una campaña y usa "Agregar piezas" en su detalle para atarlas.
            </p>
            {disponibles.map(d => (
              <Card key={d.solicitudId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{d.title}</p>
                      <MultimarcaBadge marcas={d.marcas && d.marcas.length ? d.marcas : (d.marca ? [d.marca] : [])} />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {d.consecutive}{d.producto ? ` · ${d.producto}` : ''} · {d.numeroPiezas || 0} pieza(s)
                    </p>
                    <p className="text-[10px] text-slate-400">Publicada el {formatDate(d.publishedAt)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : campanas.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="Sin campañas" text="Crea una campaña con el botón 'Nueva campaña' y luego átale piezas desde su detalle." />
      ) : (
        <div className="space-y-4">
          {/* Breadcrumb de la jerarquía */}
          <Breadcrumb segments={breadcrumb} />

          {nivel === 'HOME' && <NivelCards items={canchasCards} icon="🏬" />}

          {nivel === 'CANCHA' && (
            marcasCards.length === 0
              ? <EmptyState icon={LayoutGrid} title="Sin marcas en esta cancha" text="No hay campañas agrupadas aquí." />
              : <NivelCards items={marcasCards} icon="🏷️" />
          )}

          {nivel === 'MARCA' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {campanasDeMarca.map(c => {
                const rc = porCampana[c.campaignId] || emptyCampana();
                const p = rc.activas > 0 ? Math.round((rc.implementadas / rc.activas) * 100) : 0;
                return (
                  <button key={c.campaignId} onClick={() => navigate(`/medios/campanas/${c.campaignId}`)} className="text-left block w-full">
                    <Card className="hover:shadow-md hover:border-brand/30 transition-all cursor-pointer h-full">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-slate-900 dark:text-white truncate">🎬 {c.campanaNombre || c.title}</p>
                          <MultimarcaBadge marcas={c.marcas && c.marcas.length ? c.marcas : (c.marca ? [c.marca] : [])} className="shrink-0" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{c.consecutive}</p>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{c.totalSolicitudes ?? 0} pieza(s)</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{p}% cumplido</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">{c.totalLineas ?? c.totalPiezas ?? 0} línea(s) · creada {formatDate(c.createdAt)}</p>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {configCanchasOpen && config && (
        <ConfigCanchasModal
          taxonomia={config.taxonomia}
          onClose={() => setConfigCanchasOpen(false)}
          onSaved={() => { reloadConfig(); }}
        />
      )}
      {specsOpen && config && (
        <SpecsManagerModal
          specs={config.specs}
          onClose={() => setSpecsOpen(false)}
          onSaved={() => { reloadConfig(); }}
        />
      )}
      {crearOpen && config && (
        <CrearCampanaModal
          taxonomia={config.taxonomia}
          onClose={() => setCrearOpen(false)}
          onConfigCanchas={() => setConfigCanchasOpen(true)}
        />
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
