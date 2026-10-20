import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, Film, Layers } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useNotifications } from '../../contexts/NotificationContext';
import { mediosApi, type MedioCampanaDetalle } from '../../lib/medios-api';
import { MEDIO_ESTADO_LABELS, type MedioLinea } from '../../types/medios';
import { useMediosConfig } from './hooks/useMediosConfig';
import Breadcrumb from './components/Breadcrumb';
import Termometro, { type TermometroData } from './components/Termometro';
import EntregablesTable from './components/EntregablesTable';
import GanttCronograma from './components/GanttCronograma';
import LineaFormModal from './components/LineaFormModal';
import CargaMasivaModal from './components/CargaMasivaModal';
import EstadoBitacoraModal from './components/EstadoBitacoraModal';
import MaterialDrawer from './components/MaterialDrawer';
import SpecsDrawer from './components/SpecsDrawer';

const SIN_ASIGNAR = 'SIN ASIGNAR';
const SIN_MARCA = 'SIN MARCA';

/**
 * Detalle de campaña: breadcrumb propio (Canchas › cancha › marca › campaña, con
 * enlaces de retorno al dashboard por query string), termómetro de campaña, tabla
 * de entregables, Gantt de 3 fases, modal de estado/bitácora, drawer de material
 * (UTM read-only del backend) y drawer de specs. La taxonomía viene de
 * useMediosConfig (sin literales hardcodeados). Recarga tras cada mutación.
 */
const CampanaDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const { config } = useMediosConfig();

  const [data, setData] = useState<MedioCampanaDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  const [lineaModal, setLineaModal] = useState<{ open: boolean; linea: MedioLinea | null }>({ open: false, linea: null });
  const [masivaOpen, setMasivaOpen] = useState(false);
  const [estadoLinea, setEstadoLinea] = useState<MedioLinea | null>(null);
  const [materialLinea, setMaterialLinea] = useState<MedioLinea | null>(null);
  const [specsLinea, setSpecsLinea] = useState<MedioLinea | null>(null);

  const cargar = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await mediosApi.getCampana(id));
    } catch (e: any) {
      notify(e.message || 'No se pudo cargar la campaña', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [id]);

  // Termómetro de campaña derivado de las líneas (disjunto cargadas/enQA).
  const termo: TermometroData | null = useMemo(() => {
    if (!data) return null;
    const counts: Record<string, number> = { PENDIENTE: 0, EN_QA: 0, RECHAZADO: 0, APROBADO: 0, IMPLEMENTADO: 0, VENCIDO: 0, CANCELADO: 0 };
    let cargadas = 0, enQA = 0;
    data.lineas.forEach(l => {
      if (counts[l.estadoQA] !== undefined) counts[l.estadoQA]++;
      if (l.estadoQA === 'EN_QA') {
        if (l.linkMaterial && String(l.linkMaterial).trim()) cargadas++;
        else enQA++;
      }
    });
    return { total: data.lineas.length, counts, cargadas, enQA };
  }, [data]);

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="animate-spin mr-2" size={20} /> Cargando…</div>;
  if (!data) return <div className="text-center py-16 text-slate-500">Campaña no encontrada. <Link to="/medios" className="text-brand underline">Volver</Link></div>;

  const { meta, lineas, eventos } = data;
  const estado = MEDIO_ESTADO_LABELS[meta.estadoAgregado] || MEDIO_ESTADO_LABELS.PENDIENTE;
  const cancha = meta.cancha && meta.cancha.trim() ? meta.cancha : SIN_ASIGNAR;
  const marca = meta.marca && meta.marca.trim() ? meta.marca : SIN_MARCA;
  const nombre = meta.campanaNombre || meta.title;

  const breadcrumb = [
    { label: 'Canchas', href: '/medios?nivel=HOME' },
    { label: cancha, href: `/medios?nivel=CANCHA&cancha=${encodeURIComponent(cancha)}` },
    { label: marca, href: `/medios?nivel=MARCA&cancha=${encodeURIComponent(cancha)}&marca=${encodeURIComponent(marca)}` },
    { label: nombre },
  ];

  const taxonomia = config?.taxonomia;
  const specs = config?.specs || [];
  const festivos = config?.modulo?.festivos || [];

  const afterMutation = (closer: () => void) => { closer(); cargar(); };

  return (
    <div className="space-y-5">
      <Link to="/medios" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft size={16} /> Volver a Medios
      </Link>

      {/* Breadcrumb con enlaces de retorno granular */}
      <Breadcrumb
        segments={breadcrumb.map(s => ('href' in s && s.href
          ? { label: s.label, onClick: () => navigate(s.href!) }
          : { label: s.label }))}
      />

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Film className="text-violet-600 dark:text-violet-400" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{nombre}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {meta.consecutive} · {cancha} · {marca}{meta.tier ? ` · ${meta.tier}` : ''}
            </p>
          </div>
        </div>
        <Badge className={estado.color}>{estado.label}</Badge>
      </div>

      {/* Termómetro de campaña */}
      {termo && termo.total > 0 && <Termometro data={termo} titulo="📊 Termómetro de la campaña" />}

      {/* Entregables */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-bold text-slate-800 dark:text-slate-100">Entregables ({lineas.length})</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" disabled={!taxonomia} onClick={() => setMasivaOpen(true)}><Layers size={14} /> Carga masiva</Button>
              <Button size="sm" className="gap-1" disabled={!taxonomia} onClick={() => setLineaModal({ open: true, linea: null })}><Plus size={14} /> Agregar línea</Button>
            </div>
          </div>
          {lineas.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aún no hay entregables. Agrega la primera pieza táctica (medio, formato, fechas).</p>
          ) : (
            <EntregablesTable
              lineas={lineas}
              specs={specs}
              onEditar={l => setLineaModal({ open: true, linea: l })}
              onSpecs={l => setSpecsLinea(l)}
              onMaterial={l => setMaterialLinea(l)}
              onEstado={l => setEstadoLinea(l)}
            />
          )}
        </CardContent>
      </Card>

      {/* Cronograma / Gantt */}
      {lineas.some(l => l.fechaSalidaPauta) && (
        <Card>
          <CardContent className="p-5">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Cronograma táctico</h2>
            <GanttCronograma lineas={lineas} festivos={festivos} />
          </CardContent>
        </Card>
      )}

      {/* Modales / drawers */}
      {lineaModal.open && taxonomia && (
        <LineaFormModal
          campana={meta}
          taxonomia={taxonomia}
          festivos={festivos}
          linea={lineaModal.linea}
          onClose={() => setLineaModal({ open: false, linea: null })}
          onSaved={() => afterMutation(() => setLineaModal({ open: false, linea: null }))}
        />
      )}
      {masivaOpen && taxonomia && (
        <CargaMasivaModal
          campaignId={meta.campaignId}
          taxonomia={taxonomia}
          onClose={() => setMasivaOpen(false)}
          onSaved={() => afterMutation(() => setMasivaOpen(false))}
        />
      )}
      {estadoLinea && (
        <EstadoBitacoraModal
          campaignId={meta.campaignId}
          linea={estadoLinea}
          eventos={eventos}
          onClose={() => setEstadoLinea(null)}
          onSaved={() => afterMutation(() => setEstadoLinea(null))}
        />
      )}
      {materialLinea && (
        <MaterialDrawer
          campaignId={meta.campaignId}
          linea={materialLinea}
          onClose={() => setMaterialLinea(null)}
          onSaved={() => afterMutation(() => setMaterialLinea(null))}
        />
      )}
      {specsLinea && (
        <SpecsDrawer linea={specsLinea} specs={specs} onClose={() => setSpecsLinea(null)} />
      )}
    </div>
  );
};

export default CampanaDetailPage;
