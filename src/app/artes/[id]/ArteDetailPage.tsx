import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Check, X, Loader2, Download, Upload, History, PenTool, Clock,
  FileText, AlertCircle, RefreshCw, CheckCircle2, PlayCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import PdfViewer from '../../../components/ui/PdfViewer';
import { useArtes } from '../../../contexts/ArtesContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { artesApi, getArteDownloadUrl, uploadArteVersion } from '../../../lib/artes-api';
import { exportArteFirmado } from '../../../lib/artes-pdf';
import { cn } from '../../../lib/utils';
import { ARTE_ESTADO_LABELS } from '../../../types/artes';
import type { ArteDetailResponse } from '../../../types/artes';

const fechaHora = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(iso); }
};

type Panel = 'FIRMAS' | 'VERSIONES' | 'HISTORIAL';

const ArteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { canAprobar, canSubirAjuste, isArtesAdmin } = useArtes();
  const { notify } = useNotifications();

  const [data, setData] = useState<ArteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [viendoVersion, setViendoVersion] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>('FIRMAS');

  const [nota, setNota] = useState('');
  const [confirmando, setConfirmando] = useState<'APROBADO' | 'RECHAZADO' | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [notaVersion, setNotaVersion] = useState('');
  const [avisoVersion, setAvisoVersion] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await artesApi.get(id);
      setData(res);
      setViendoVersion(null);
      if (res.flow.s3Key) {
        try { setPdfUrl(await getArteDownloadUrl(res.flow.s3Key)); }
        catch { setPdfUrl(null); }
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el arte');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const flow = data?.flow;
  const myTeamIds = useMemo(() => (data?.myTeams || []).map(t => t.id), [data]);
  const esMiTurno = !!flow?.currentTeamId && myTeamIds.includes(flow.currentTeamId);
  const esDiseno = !!data?.designTeam && myTeamIds.includes(data.designTeam.id);
  // El backend calcula callerCanSign considerando el integrante asignado y la
  // config anyMemberCanSign. Un admin de flujo siempre puede. Si no viene el
  // dato (respuesta antigua), se cae al comportamiento por turno + permiso.
  const puedoFirmarEsteEquipo = data?.callerCanSign ?? (esMiTurno && canAprobar);
  const puedeFirmar = !!flow && flow.estado === 'EN_CURSO' && (isArtesAdmin || (puedoFirmarEsteEquipo && canAprobar));
  // Correo asignado al equipo del turno (para avisar a quién le toca).
  const asignadoTurno = flow?.currentTeamId ? (flow.assignees || {})[flow.currentTeamId] : '';
  const puedeSubirVersion = !!flow && flow.estado !== 'APROBADO' && (esDiseno || isArtesAdmin) && canSubirAjuste;

  const decidir = async (decision: 'APROBADO' | 'RECHAZADO') => {
    if (!flow || !id) return;
    if (confirmando !== decision) { setConfirmando(decision); return; }
    if (decision === 'RECHAZADO' && !nota.trim()) {
      notify('Indica el motivo para devolver el arte a Diseño', 'error');
      return;
    }
    // Siempre se firma por el equipo que tiene el turno
    const teamId = flow.currentTeamId;
    if (!teamId) { notify('Este arte no tiene un equipo con el turno asignado', 'error'); return; }
    setEnviando(true);
    try {
      await artesApi.decidir(id, { teamId, decision, comment: nota.trim() });
      notify(
        decision === 'APROBADO'
          ? 'Arte firmado. Se notificó al siguiente responsable.'
          : 'Arte devuelto a Diseño con tus comentarios.',
        'success',
      );
      setNota('');
      setConfirmando(null);
      await cargar();
    } catch (e: any) {
      notify(e?.message || 'No se pudo registrar la decisión', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const subirVersion = async (file: File) => {
    if (!id || !flow) return;
    if (file.type !== 'application/pdf') {
      notify('El arte debe ser un archivo PDF', 'error');
      return;
    }
    const siguiente = Math.max(
      flow.arteVersion || 1,
      ...(data?.versions || []).map(v => v.versionNumber),
    ) + 1;
    setSubiendo(true);
    try {
      const { s3Key } = await uploadArteVersion(id, file, siguiente);
      await artesApi.crearVersion(id, {
        s3Key, fileName: file.name, fileSize: file.size, changeNote: notaVersion.trim(),
      });
      notify(`Versión v${siguiente} subida. El flujo de firmas se reinició.`, 'success');
      setAvisoVersion(`Se subió la versión v${siguiente} y el flujo de firmas se reinició. La versión anterior queda disponible en la pestaña Versiones.`);
      setNotaVersion('');
      if (fileRef.current) fileRef.current.value = '';
      setPanel('VERSIONES');
      await cargar();
    } catch (e: any) {
      notify(e?.message || 'No se pudo subir la versión', 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const verVersion = async (s3Key: string, versionNumber: number | null) => {
    try {
      setPdfUrl(await getArteDownloadUrl(s3Key));
      setViendoVersion(versionNumber);
    } catch (e: any) {
      notify(e?.message || 'No se pudo cargar esa versión', 'error');
    }
  };

  const exportar = async () => {
    if (!data) return;
    setExportando(true);
    try {
      await exportArteFirmado({ flow: data.flow, approvals: data.approvals, teams: data.teams });
      notify('PDF con la hoja de firmas descargado', 'success');
    } catch (e: any) {
      notify(e?.message || 'No se pudo generar el PDF firmado', 'error');
    } finally {
      setExportando(false);
    }
  };

  const iniciar = async () => {
    if (!id) return;
    try {
      await artesApi.start(id, true);
      notify('Flujo iniciado', 'success');
      await cargar();
    } catch (e: any) {
      notify(e?.message || 'No se pudo iniciar el flujo', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
        <Loader2 size={24} className="animate-spin" /> Cargando arte...
      </div>
    );
  }

  if (error || !flow || !data) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertCircle size={48} className="mx-auto text-slate-200" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">
          {error || 'Arte no encontrado'}
        </h3>
        <div className="flex items-center justify-center gap-2">
          <Link to="/artes/cola"><Button variant="outline" className="gap-2"><ArrowLeft size={16} /> Volver a la cola</Button></Link>
          {isArtesAdmin && id && (
            <Button className="gap-2" onClick={iniciar}><PlayCircle size={16} /> Iniciar flujo para esta pieza</Button>
          )}
        </div>
      </div>
    );
  }

  const estado = ARTE_ESTADO_LABELS[flow.estado] || ARTE_ESTADO_LABELS.EN_CURSO;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="min-w-0">
          <Link to="/artes/cola" className="text-xs text-slate-400 hover:text-brand flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Cola de artes
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{flow.title}</h1>
            <Badge className={cn('text-[10px]', estado.color)}>{estado.label}</Badge>
            <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 text-[10px]">v{flow.arteVersion}</Badge>
            {flow.cycle > 1 && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Ronda {flow.cycle}</Badge>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {flow.consecutive} · {flow.brand} · Solicitante: {flow.solicitanteName || '—'}
            {flow.area ? ` (${flow.area})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={cargar} className="text-slate-400" title="Actualizar">
            <RefreshCw size={18} />
          </Button>
          <Link to={`/solicitudes/${flow.solicitudId}`}>
            <Button variant="outline" size="sm" className="gap-1"><FileText size={14} /> Ver en el comité</Button>
          </Link>
          <Button size="sm" className="gap-1" onClick={exportar} disabled={exportando}>
            {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF firmado
          </Button>
        </div>
      </div>

      {avisoVersion && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300">{avisoVersion}</p>
          </div>
          <button className="text-emerald-500 hover:text-emerald-700 shrink-0" onClick={() => setAvisoVersion(null)} title="Cerrar">
            <X size={16} />
          </button>
        </div>
      )}

      {viendoVersion !== null && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Estás viendo la versión <strong>v{viendoVersion}</strong> (histórica).
          </p>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => verVersion(flow.s3Key, null)}>
            Ver versión vigente
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        {/* Visor */}
        <Card className="overflow-hidden">
          <PdfViewer url={pdfUrl} fileName={flow.fileName} />
        </Card>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Acción de firma */}
          {puedeFirmar ? (
            <Card className="border-brand/30 ring-1 ring-brand/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PenTool size={16} className="text-brand" />
                  Firma de {flow.currentTeamLabel}
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Firmas en nombre de todo tu equipo. Queda registrado tu nombre, correo, fecha y hora.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={nota}
                  onChange={e => { setNota(e.target.value); setConfirmando(null); }}
                  placeholder="Comentario (obligatorio si devuelves el arte a Diseño)"
                  className="w-full p-3 text-sm border rounded-lg min-h-[80px] bg-slate-50 dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-brand outline-none"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    className={cn('gap-2', confirmando === 'APROBADO' && 'bg-emerald-600 hover:bg-emerald-700')}
                    onClick={() => decidir('APROBADO')}
                    disabled={enviando}
                  >
                    {enviando && confirmando === 'APROBADO'
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Check size={16} />}
                    {confirmando === 'APROBADO' ? 'Confirmar firma' : 'Aprobar y firmar'}
                  </Button>
                  <Button
                    variant="outline"
                    className={cn('gap-2 text-pink-600 border-pink-200 hover:bg-pink-50',
                      confirmando === 'RECHAZADO' && 'bg-pink-600 text-white border-pink-600 hover:bg-pink-700')}
                    onClick={() => decidir('RECHAZADO')}
                    disabled={enviando}
                  >
                    {enviando && confirmando === 'RECHAZADO'
                      ? <Loader2 size={16} className="animate-spin" />
                      : <X size={16} />}
                    {confirmando === 'RECHAZADO' ? 'Confirmar devolución' : 'Devolver a Diseño'}
                  </Button>
                  {confirmando && (
                    <button className="text-[11px] text-slate-400 hover:text-slate-600" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : flow.estado === 'EN_CURSO' ? (
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <Clock size={18} className="text-brand mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Esperando la firma de {flow.currentTeamLabel}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {asignadoTurno
                      ? `Se le notificó por correo a ${asignadoTurno}, responsable asignado de este equipo.`
                      : 'Se le notificó por correo al equipo responsable.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : flow.estado === 'APROBADO' ? (
            <Card className="border-emerald-200">
              <CardContent className="p-4 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Aprobado por todos los equipos
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Completado el {fechaHora(flow.completedAt)}.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-pink-200">
              <CardContent className="p-4 flex items-start gap-3">
                <PenTool size={18} className="text-pink-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-pink-700 dark:text-pink-400">
                    Devuelto a Diseño para ajustes
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Devuelto por {(flow.approvals || {})[flow.rejectedByTeamId || '']?.teamLabel || 'un equipo'}.
                    Al subir la versión corregida el flujo se reinicia.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subida de ajuste (Diseño) */}
          {puedeSubirVersion && (
            <Card className="border-pink-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload size={16} className="text-pink-600" /> Subir arte corregido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={notaVersion}
                  onChange={e => setNotaVersion(e.target.value)}
                  placeholder="¿Qué se ajustó? (se envía en el correo al equipo)"
                  className="w-full p-2.5 text-sm border rounded-lg min-h-[60px] bg-slate-50 dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-brand outline-none"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirVersion(f); }}
                />
                <Button
                  className="w-full gap-2 bg-pink-600 hover:bg-pink-700"
                  onClick={() => fileRef.current?.click()}
                  disabled={subiendo}
                >
                  {subiendo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {subiendo ? 'Subiendo...' : 'Seleccionar PDF corregido'}
                </Button>
                <p className="text-[11px] text-slate-400">
                  Se guarda como una versión nueva y el flujo de firmas vuelve a empezar según la configuración.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tabs del panel */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {([
              { key: 'FIRMAS', label: 'Firmas', icon: Check },
              { key: 'VERSIONES', label: `Versiones (${Math.max(data.versions.length, 1)})`, icon: History },
              { key: 'HISTORIAL', label: 'Historial', icon: Clock },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setPanel(t.key)}
                className={cn('flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors',
                  panel === t.key ? 'bg-white dark:bg-slate-700 text-brand shadow-sm' : 'text-slate-400 hover:text-slate-600')}
              >
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>

          {/* Firmas */}
          {panel === 'FIRMAS' && (
            <Card>
              <CardContent className="p-4 space-y-2">
                {data.teams.map((team, i) => {
                  const firma = (flow.approvals || {})[team.id];
                  const firmado = firma?.decision === 'APROBADO';
                  const turno = flow.currentTeamId === team.id;
                  const mio = myTeamIds.includes(team.id);
                  return (
                    <div
                      key={team.id}
                      className={cn('flex items-start gap-3 p-3 rounded-lg border',
                        firmado ? 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200'
                          : turno ? 'bg-brand-50 dark:bg-blue-900/20 border-brand/30'
                          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700')}
                    >
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        firmado ? 'bg-emerald-500 text-white'
                          : turno ? 'bg-brand text-white'
                          : 'bg-slate-200 dark:bg-slate-600 text-slate-500')}>
                        {firmado ? <Check size={14} /> : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{team.label}</p>
                          {mio && <Badge className="bg-brand text-white text-[9px]">Mi equipo</Badge>}
                        </div>
                        {firma ? (
                          <>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                              {firma.by} · {firma.email}
                            </p>
                            <p className="text-[11px] text-slate-400">{fechaHora(firma.at)}</p>
                            {firma.comment && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 bg-white dark:bg-slate-800 rounded p-2 border border-slate-100 dark:border-slate-700">
                                {firma.comment}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {turno ? 'Pendiente de firma' : 'En espera de su turno'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Versiones */}
          {panel === 'VERSIONES' && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <button
                  onClick={() => verVersion(flow.s3Key, null)}
                  className={cn('w-full text-left p-3 rounded-lg border transition-colors',
                    viendoVersion === null
                      ? 'border-brand bg-brand-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">v{flow.arteVersion} (vigente)</p>
                    <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Actual</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{flow.fileName || 'arte.pdf'}</p>
                </button>

                {data.versions
                  .filter(v => v.versionNumber !== flow.arteVersion)
                  .map(v => (
                    <button
                      key={v.sk}
                      onClick={() => verVersion(v.s3Key, v.versionNumber)}
                      className={cn('w-full text-left p-3 rounded-lg border transition-colors',
                        viendoVersion === v.versionNumber
                          ? 'border-brand bg-brand-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}
                    >
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">v{v.versionNumber}</p>
                      <p className="text-[11px] text-slate-500 truncate">{v.fileName}</p>
                      <p className="text-[11px] text-slate-400">
                        {v.userName || '—'} · {fechaHora(v.uploadedAt)}
                      </p>
                      {v.changeNote && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{v.changeNote}</p>
                      )}
                    </button>
                  ))}

                {data.versions.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-2">
                    Todavía no hay ajustes de Diseño. La versión vigente es la aprobada por el comité.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Historial */}
          {panel === 'HISTORIAL' && (
            <Card>
              <CardContent className="p-4 space-y-2">
                {data.approvals.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-2">Sin decisiones registradas todavía.</p>
                )}
                {data.approvals.map(a => {
                  const ok = a.decision === 'APROBADO';
                  return (
                    <div key={a.sk} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                      <span className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        ok ? 'bg-emerald-500' : 'bg-pink-500')}>
                        {ok ? <Check size={11} className="text-white" /> : <X size={11} className="text-white" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {a.teamLabel} {ok ? 'aprobó' : 'devolvió'} · v{a.arteVersion} · ronda {a.cycle}
                        </p>
                        <p className="text-[11px] text-slate-500">{a.approverName} · {fechaHora(a.at)}</p>
                        {a.comment && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{a.comment}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Nota para quien no puede firmar */}
          {flow.estado === 'EN_CURSO' && esMiTurno && !canAprobar && (
            <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              Tu equipo tiene el turno, pero tu rol ({user?.role}) no tiene habilitado el permiso para firmar artes.
              Pide al administrador que lo active en Configuración &gt; Roles y Permisos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArteDetailPage;
