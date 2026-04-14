import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageSquare, ShieldCheck, CheckCircle2, XCircle, Send, FileText, Pin, PlusCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { cn, formatDate } from '../../../lib/utils';
import { Solicitud, Comment, PdfAnnotation, AnnotationTool } from '../../../types';
import { solicitudesApi, comentariosApi, anotacionesApi, versionesApi, apiFetch } from '../../../lib/api';
import PdfViewer from '../../../components/ui/PdfViewer';

type PanelTab = 'IA' | 'COMENTARIOS' | 'ANOTACIONES' | 'VERSIONES';

const RevisionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const { emailConfig } = useConfig();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>('ANOTACIONES');
  const [comment, setComment] = useState('');
  const [annotationText, setAnnotationText] = useState('');
  const [addingAnnotation, setAddingAnnotation] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<{ x: number; y: number } | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pin');
  const [annotationColor, setAnnotationColor] = useState('#ef4444');
  const [pendingShapeAnnotation, setPendingShapeAnnotation] = useState<PdfAnnotation | null>(null);
  const [shapeAnnotationText, setShapeAnnotationText] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'APPROVE' | 'APPROVE_OBS' | 'REJECT' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const currentPdfPageRef = useRef(1);
  const goToPageRef = useRef<((page: number) => void) | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      const s = await solicitudesApi.get(id);
      try {
        const [comentarios, anotaciones] = await Promise.all([
          comentariosApi.list(id),
          anotacionesApi.list(id),
        ]);
        s.comments = comentarios || s.comments || [];
        s.annotations = anotaciones || s.annotations || [];
      } catch { /* usa los que vienen en el objeto */ }

      try {
        const versiones = await versionesApi.list(id);
        const apiVersions = (versiones || []).map((v: any) => ({
          id: v.id || v.sk,
          solicitudId: id!,
          s3Key: v.s3Key || '',
          fileName: v.fileName || '',
          fileSize: v.fileSize || 0,
          version: v.versionNumber || v.version || 1,
          userId: v.userId || '',
          userName: v.userName || '',
          uploadedAt: v.uploadedAt || '',
          active: v.active ?? false,
          changeNote: v.changeNote,
        }));
        if (apiVersions.length > 0) {
          const maxVer = Math.max(...apiVersions.map((v: any) => v.version));
          s.versions = apiVersions.map((v: any) => ({ ...v, active: v.version === maxVer }));
        }
      } catch { /* versiones API puede no estar desplegada aún */ }

      if ((!s.versions || s.versions.length === 0) && s.files?.[0]) {
        const f = s.files[0] as any;
        s.versions = [{
          id: f.id || 'v1-auto',
          solicitudId: id!,
          s3Key: f.s3Key || '',
          fileName: f.name || '',
          fileSize: f.size || 0,
          version: 1,
          userId: s.solicitanteId || '',
          userName: s.solicitanteName || '',
          uploadedAt: f.uploadedAt || s.createdAt || '',
          active: true,
        }];
      }

      setSolicitud(s);
      setViewingVersion(null);
      const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
      const activeFile = s?.files?.[0];
      if (PRESIGN_URL && activeFile?.s3Key) {
        fetch(PRESIGN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'download', key: activeFile.s3Key }),
        }).then(r => r.json()).then(d => { if (d.url) setPdfUrl(d.url); }).catch(() => {});
      }
    } catch { setSolicitud(null); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    notify('Datos actualizados', 'success');
  };

  const loadVersionPdf = async (s3Key: string, versionNum: number) => {
    const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
    if (!PRESIGN_URL || !s3Key) return;
    try {
      const res = await fetch(PRESIGN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', key: s3Key }),
      });
      const { url } = await res.json();
      if (url) { setPdfUrl(url); setViewingVersion(versionNum); }
    } catch { /* silencioso */ }
  };

  const loadCurrentVersionPdf = () => {
    const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
    const activeFile = solicitud?.files?.[0] as any;
    if (PRESIGN_URL && activeFile?.s3Key) {
      fetch(PRESIGN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', key: activeFile.s3Key }),
      }).then(r => r.json()).then(d => { if (d.url) { setPdfUrl(d.url); setViewingVersion(null); } }).catch(() => {});
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
      <RefreshCw size={24} className="animate-spin" /> Cargando solicitud...
    </div>
  );

  if (!solicitud) return <div className="p-8 text-slate-500">Solicitud no encontrada.</div>;

  const canAnnotate = user?.role === 'REVISOR_ARA' || user?.role === 'REVISOR_LEGAL' || user?.role === 'ADMIN';
  const isARA = user?.role === 'REVISOR_ARA' || user?.role === 'ADMIN';
  const isLegal = user?.role === 'REVISOR_LEGAL' || user?.role === 'ADMIN';

  // Determina si este revisor ya aprobó
  const myApproval = isARA ? solicitud.approvalARA : isLegal ? solicitud.approvalLegal : null;
  const otherApproval = isARA ? solicitud.approvalLegal : solicitud.approvalARA;

  const handleAction = async (type: 'APPROVE' | 'APPROVE_OBS' | 'REJECT') => {
    if (type === 'REJECT' && !confirmAction) {
      setConfirmAction('REJECT');
      return;
    }
    if (type === 'APPROVE' && !confirmAction) {
      setConfirmAction('APPROVE');
      return;
    }
    if (type === 'APPROVE_OBS' && !confirmAction) {
      setConfirmAction('APPROVE_OBS');
      return;
    }

    const isApproval = type === 'APPROVE' || type === 'APPROVE_OBS';
    const now = new Date().toISOString();
    const approvalData = { approved: isApproval, by: user?.name || 'Revisor', at: now, nota: actionNote || '' };

    // Construye las aprobaciones actualizadas
    let updatedARA = solicitud.approvalARA;
    let updatedLegal = solicitud.approvalLegal;
    if (isARA) updatedARA = approvalData;
    if (isLegal) updatedLegal = approvalData;

    // Calcula el estado final
    let newStatus: string;
    if (type === 'REJECT') {
      newStatus = 'RECHAZADA';
      updatedARA = undefined;
      updatedLegal = undefined;
    } else if (updatedARA?.approved && updatedLegal?.approved) {
      // Ambos revisaron — el tipo del último determina si es con o sin comentarios
      // Si cualquiera de los dos marcó "con comentarios", queda con comentarios
      const otherHadObs = isARA
        ? solicitud.approvalLegal?.nota?.includes('[CON_COMENTARIOS]')
        : solicitud.approvalARA?.nota?.includes('[CON_COMENTARIOS]');
      newStatus = (type === 'APPROVE_OBS' || otherHadObs) ? 'APROBADA_OBSERVACIONES' : 'APROBADA';
    } else {
      newStatus = 'EN_REVISION';
    }

    // Marca en la nota si fue con comentarios (para que el otro revisor lo sepa)
    if (type === 'APPROVE_OBS' && !actionNote.includes('[CON_COMENTARIOS]')) {
      approvalData.nota = (actionNote || '') + ' [CON_COMENTARIOS]';
    }

    try {
      // Envía status + aprobaciones al backend
      const body: any = { status: newStatus, nota: actionNote };
      if (updatedARA !== undefined) body.approvalARA = updatedARA;
      if (updatedLegal !== undefined) body.approvalLegal = updatedLegal;
      await apiFetch(`/solicitudes/${solicitud.id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
    } catch (e: any) { notify(e.message, 'error'); return; }

    // Nombre real del solicitante (fallback si se guardó como "Usuario")
    const solicitanteNombre = (!solicitud.solicitanteName || solicitud.solicitanteName === 'Usuario')
      ? ((solicitud as any).solicitanteEmail?.split('@')[0]?.replace(/\./g, ' ') || 'Solicitante')
      : solicitud.solicitanteName;

    // Helper: resuelve destinatarios de una regla de correo
    const getEmailsForEvent = (eventName: string) => {
      const rule = emailConfig.rules.find(r => r.event === eventName && r.enabled);
      const solicitanteEmail = (solicitud as any).solicitanteEmail;
      const extraTo = rule?.toEmails || [];
      const extraCc = rule?.cc || ['nicolas.carreno@alpina.com'];
      const to = solicitanteEmail ? [solicitanteEmail, ...extraTo] : extraTo.length > 0 ? extraTo : ['nicolas.carreno@alpina.com'];
      return { to, cc: extraCc };
    };

    // Enviar correo de aprobación parcial (solo un equipo aprobó)
    if ((type === 'APPROVE' || type === 'APPROVE_OBS') && newStatus === 'EN_REVISION') {
      const SES_URL = (import.meta as any).env?.VITE_SES_LAMBDA_URL as string;
      if (SES_URL) {
        const equipoQueAprobo = isARA ? 'ARA & Nutricion' : 'Legal';
        const equipoPendiente = isARA ? 'Legal' : 'ARA & Nutricion';
        const { to, cc } = getEmailsForEvent('solicitud_aprobacion_parcial');
        const token = localStorage.getItem('alpina_id_token');
        const emailBody = {
          template: 'aprobacion_parcial', to, cc,
          data: {
            id: solicitud.id, consecutive: solicitud.consecutive, title: solicitud.title,
            brand: solicitud.brand, solicitanteName: solicitanteNombre,
            equipoQueAprobo, equipoPendiente,
            nota: actionNote || `El equipo de ${equipoQueAprobo} aprobó. Falta la aprobación del equipo de ${equipoPendiente}.`,
          },
        };
        fetch(SES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(emailBody),
        }).then(r => {
          if (!r.ok) {
            // Fallback: si el template no existe aún, usa cambio_estado
            return fetch(SES_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({
                template: 'cambio_estado', to, cc,
                data: {
                  id: solicitud.id, consecutive: solicitud.consecutive, title: solicitud.title,
                  brand: solicitud.brand, solicitanteName: solicitanteNombre,
                  status: 'APROBADA', statusLabel: `Aprobada por ${equipoQueAprobo}`,
                  nota: `El equipo de ${equipoQueAprobo} aprobó tu pieza. Falta la aprobación del equipo de ${equipoPendiente}.`,
                },
              }),
            });
          }
        }).catch(console.error);
      }
    }

    // Enviar correo cuando hay decisión final (ambos revisaron o rechazado)
    if (newStatus === 'APROBADA' || newStatus === 'APROBADA_OBSERVACIONES' || newStatus === 'RECHAZADA') {
      const SES_URL = (import.meta as any).env?.VITE_SES_LAMBDA_URL as string;
      if (SES_URL) {
        const statusLabels: Record<string, string> = { APROBADA: 'Sin comentarios', APROBADA_OBSERVACIONES: 'Con comentarios', RECHAZADA: 'Rechazada' };
        const eventName = newStatus === 'RECHAZADA' ? 'solicitud_rechazada' : newStatus === 'APROBADA_OBSERVACIONES' ? 'solicitud_con_observaciones' : 'solicitud_aprobada';
        const { to, cc } = getEmailsForEvent(eventName);
        const token = localStorage.getItem('alpina_id_token');
        fetch(SES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            template: 'cambio_estado', to, cc,
            data: {
              id: solicitud.id, consecutive: solicitud.consecutive, title: solicitud.title,
              brand: solicitud.brand, solicitanteName: solicitanteNombre,
              status: newStatus, statusLabel: statusLabels[newStatus] || newStatus,
              nota: actionNote || '',
            },
          }),
        }).catch(console.error);
      }
    }

    const messages: Record<string, string> = {
      APROBADA: 'Pieza revisada — sin comentarios',
      APROBADA_OBSERVACIONES: 'Pieza revisada — con comentarios. El solicitante debe subir la pieza final.',
      RECHAZADA: 'Pieza rechazada',
      EN_REVISION: 'Tu aprobación fue registrada. Falta la otra área.',
    };
    notify(messages[newStatus], type === 'REJECT' ? 'error' : 'success');
    setConfirmAction(null);
    setActionNote('');
    navigate('/revision');
  };

  const handleAddComment = () => {
    if (!comment.trim() || !user) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      text: comment.trim(),
      createdAt: new Date().toISOString(),
      area: user.area,
    };
    setSolicitud(prev => {
      if (!prev) return prev;
      const updated = { ...prev, comments: [...prev.comments, newComment] };
      return updated;
    });
    setComment('');
    notify('Comentario agregado', 'success');
    // Persiste en API
    comentariosApi.create(solicitud.id, { text: comment.trim(), userName: user.name, userRole: user.role, area: user.area || '' }).catch(console.error);
  };

  const handleSaveAnnotation = () => {
    if (!pendingAnnotation || !annotationText.trim() || !user) return;
    const ann: PdfAnnotation = {
      id: Date.now().toString(),
      solicitudId: solicitud.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      text: annotationText.trim(),
      page: currentPdfPageRef.current,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      createdAt: new Date().toISOString(),
      area: user.area,
      version: solicitud.currentVersion,
      resolved: false,
    };
    setSolicitud(prev => {
      if (!prev) return prev;
      return { ...prev, annotations: [...prev.annotations, ann] };
    });
    anotacionesApi.create(solicitud.id, {
      text: annotationText.trim(),
      page: currentPdfPageRef.current,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      userName: user.name,
      userRole: user.role,
      area: user.area || '',
    }).catch(console.error);
    setAnnotationText('');
    setPendingAnnotation(null);
    setAddingAnnotation(false);
    notify('Anotación agregada al PDF', 'success');
    setActiveTab('ANOTACIONES');
  };

  const handleSaveShapeAnnotation = () => {
    if (!pendingShapeAnnotation || !user) return;
    const ann = { ...pendingShapeAnnotation, text: shapeAnnotationText.trim() || `Anotación ${pendingShapeAnnotation.tool}` };
    setSolicitud(prev => {
      if (!prev) return prev;
      return { ...prev, annotations: [...prev.annotations, ann] };
    });
    anotacionesApi.create(solicitud.id, {
      text: ann.text, page: ann.page, x: ann.x, y: ann.y,
      userName: user.name, userRole: user.role, area: user.area || '',
      x2: ann.x2, y2: ann.y2, tool: ann.tool, color: ann.color, points: ann.points,
    } as any).catch(console.error);
    setShapeAnnotationText('');
    setPendingShapeAnnotation(null);
    notify('Anotación agregada', 'success');
  };

  const handleResolveAnnotation = (annId: string) => {
    setSolicitud(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        annotations: prev.annotations.map(a =>
          a.id === annId ? { ...a, resolved: true, resolvedBy: user?.name, resolvedAt: new Date().toISOString() } : a
        ),
      };
    });
    notify('Anotación marcada como resuelta', 'success');
  };

  const scrollToAnnotation = (ann: PdfAnnotation) => {
    goToPageRef.current?.(ann.page);
    notify(`Página ${ann.page} — ${ann.text.substring(0, 50)}${ann.text.length > 50 ? '...' : ''}`, 'info');
  };

  const TABS: { key: PanelTab; label: string }[] = [
    { key: 'ANOTACIONES', label: `Anotaciones PDF (${solicitud.annotations.length})` },
    { key: 'COMENTARIOS', label: `Blog (${solicitud.comments.length})` },
    { key: 'VERSIONES', label: `v${solicitud.currentVersion}` },
  ];

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft size={24} /></Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{solicitud.title}</h1>
              <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px]">v{solicitud.currentVersion}</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{solicitud.consecutive} · {solicitud.brand} · {solicitud.solicitanteName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón refrescar */}
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="text-slate-400 hover:text-slate-600" title="Actualizar datos">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </Button>
          {/* Indicadores de aprobación */}
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
              solicitud.approvalARA?.approved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
              solicitud.approvalARA?.approved === false ? 'bg-red-100 text-red-700 border-red-200' :
              'bg-slate-100 text-slate-500 border-slate-200')}>
              ARA {solicitud.approvalARA?.approved ? '✓' : solicitud.approvalARA?.approved === false ? '✗' : '—'}
            </span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
              solicitud.approvalLegal?.approved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
              solicitud.approvalLegal?.approved === false ? 'bg-red-100 text-red-700 border-red-200' :
              'bg-slate-100 text-slate-500 border-slate-200')}>
              Legal {solicitud.approvalLegal?.approved ? '✓' : solicitud.approvalLegal?.approved === false ? '✗' : '—'}
            </span>
          </div>
          {myApproval?.approved ? (
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">✓ Ya revisaste</span>
          ) : (
            <>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 gap-1" onClick={() => handleAction('REJECT')}><XCircle size={16} /><span className="hidden sm:inline">Rechazar</span></Button>
              <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-1" onClick={() => handleAction('APPROVE_OBS')}><MessageSquare size={16} /><span className="hidden sm:inline">Con comentarios</span></Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={() => handleAction('APPROVE')}><CheckCircle2 size={16} /><span className="hidden sm:inline">Sin comentarios</span></Button>
            </>
          )}
        </div>
      </div>

      {/* Modal confirmación rechazo */}
      {confirmAction === 'REJECT' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">¿Rechazar esta pieza?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Se notificará al solicitante con el motivo.</p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Motivo del rechazo (recomendado)</label>
              <textarea
                className="w-full p-3 text-sm border rounded-lg focus:ring-1 focus:ring-red-400 outline-none min-h-[80px] bg-white dark:bg-slate-900"
                placeholder="Describe por qué se rechaza la pieza..."
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setConfirmAction(null); setActionNote(''); }}>Cancelar</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white gap-2" onClick={() => handleAction('REJECT')}>
                <XCircle size={16} /> Confirmar rechazo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación — Sin comentarios o Con comentarios */}
      {(confirmAction === 'APPROVE' || confirmAction === 'APPROVE_OBS') && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', confirmAction === 'APPROVE_OBS' ? 'bg-blue-100' : 'bg-emerald-100')}>
                {confirmAction === 'APPROVE_OBS' ? <MessageSquare size={20} className="text-blue-600" /> : <CheckCircle2 size={20} className="text-emerald-600" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {confirmAction === 'APPROVE_OBS' ? '¿Marcar con comentarios?' : '¿Marcar sin comentarios?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {confirmAction === 'APPROVE_OBS'
                    ? 'La pieza pasará pero el solicitante deberá subir la versión final corregida.'
                    : otherApproval?.approved
                      ? 'La otra área ya revisó. La pieza quedará lista para publicar.'
                      : 'Tu revisión quedará registrada. Falta la revisión de la otra área.'}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nota (opcional)</label>
              <textarea
                className={cn('w-full p-3 text-sm border rounded-lg outline-none min-h-[60px] bg-white dark:bg-slate-900', confirmAction === 'APPROVE_OBS' ? 'focus:ring-1 focus:ring-blue-400' : 'focus:ring-1 focus:ring-emerald-400')}
                placeholder={confirmAction === 'APPROVE_OBS' ? 'Describe qué debe corregir el solicitante...' : 'Alguna nota adicional...'}
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setConfirmAction(null); setActionNote(''); }}>Cancelar</Button>
              <Button className={cn('gap-2 text-white', confirmAction === 'APPROVE_OBS' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700')} onClick={() => handleAction(confirmAction!)}>
                {confirmAction === 'APPROVE_OBS' ? <><MessageSquare size={16} /> Confirmar con comentarios</> : <><CheckCircle2 size={16} /> Confirmar sin comentarios</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para texto de anotación de forma (rect, línea, etc.) */}
      {pendingShapeAnnotation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: pendingShapeAnnotation.color || '#ef4444' }}>
                <Pin size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Agregar comentario</h3>
                <p className="text-xs text-slate-500">Pág. {pendingShapeAnnotation.page} · {pendingShapeAnnotation.tool}</p>
              </div>
            </div>
            <textarea
              className="w-full p-3 text-sm border rounded-lg focus:ring-1 focus:ring-blue-400 outline-none min-h-[80px] bg-white dark:bg-slate-900"
              placeholder="Describe la observación..."
              value={shapeAnnotationText}
              onChange={e => setShapeAnnotationText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setPendingShapeAnnotation(null); setShapeAnnotationText(''); }}>Cancelar</Button>
              <Button className="gap-2" style={{ backgroundColor: pendingShapeAnnotation.color || '#1e3a5f' }} onClick={handleSaveShapeAnnotation}>
                Guardar anotación
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main — en móvil apilado, en desktop lado a lado */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Visor PDF */}
        <div className="flex-1 rounded-xl border-2 border-slate-300 dark:border-slate-600 overflow-hidden flex flex-col relative" style={{ minHeight: 'calc(100vh - 180px)' }}>
          {/* Botón anotar */}
          {canAnnotate && (
            <div className="absolute top-14 right-4 z-20">
              <Button
                variant={addingAnnotation ? 'default' : 'outline'}
                size="sm"
                className={cn('gap-1 text-xs shadow', addingAnnotation && 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500')}
                onClick={() => { setAddingAnnotation(v => !v); setPendingAnnotation(null); }}
              >
                <Pin size={14} /> {addingAnnotation ? 'Cancelar anotación' : 'Anotar en PDF'}
              </Button>
            </div>
          )}

          {addingAnnotation && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2 text-xs text-yellow-800 font-medium shadow">
              Haz clic en el PDF para colocar una anotación
            </div>
          )}

          {/* Anotaciones se muestran en el panel lateral, no superpuestas */}

          {/* Indicador de versión anterior */}
          {viewingVersion && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-amber-50 border-b border-amber-300 px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700">Viendo versión anterior: v{viewingVersion}</span>
              <Button variant="outline" size="sm" className="text-xs h-7 text-amber-700 border-amber-300 hover:bg-amber-100" onClick={loadCurrentVersionPdf}>
                Volver a v{solicitud.currentVersion}
              </Button>
            </div>
          )}

          <PdfViewer
            url={pdfUrl}
            fileName={solicitud.files[0]?.name}
            className="flex-1"
            annotating={addingAnnotation}
            activeTool={activeTool}
            annotationColor={annotationColor}
            showToolbar={true}
            onToolChange={setActiveTool}
            onColorChange={setAnnotationColor}
            annotations={solicitud.annotations.map(a => ({
              id: a.id, page: a.page, x: a.x, y: a.y,
              x2: a.x2, y2: a.y2, tool: a.tool, color: a.color,
              points: a.points,
              text: a.text, userName: a.userName, area: a.area,
              resolved: a.resolved,
            }))}
            pendingPin={pendingAnnotation}
            onAnnotationClick={(page, x, y, x2, y2, tool, color, points) => {
              if (tool === 'pin') {
                setPendingAnnotation({ x, y });
              }
              currentPdfPageRef.current = page;
              // For non-pin tools, save immediately with a default text prompt
              if (tool && tool !== 'pin') {
                const ann: PdfAnnotation = {
                  id: Date.now().toString(),
                  solicitudId: solicitud.id,
                  userId: user!.id,
                  userName: user!.name,
                  userRole: user!.role,
                  text: '',
                  page,
                  x, y, x2, y2,
                  tool, color,
                  points,
                  createdAt: new Date().toISOString(),
                  area: user!.area,
                  version: solicitud.currentVersion,
                  resolved: false,
                };
                // Store temporarily and prompt for text
                setPendingShapeAnnotation(ann);
              }
              setActiveTab('ANOTACIONES');
            }}
            onPageChange={(p) => { currentPdfPageRef.current = p; }}
            goToPageRef={goToPageRef}
          />
        </div>

        {/* Panel derecho */}
        <div className="w-full lg:w-[380px] flex flex-col gap-4 shrink-0">
          <Card className="flex-1 flex flex-col min-h-0 shadow-md border-none">
            {/* Tabs */}
            <div className="flex border-b overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn('flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap px-2', activeTab === t.key ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-400 hover:text-slate-600')}>
                  {t.label}
                </button>
              ))}
            </div>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* IA */}
              {activeTab === 'IA' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-700"><ShieldCheck size={18} /><span className="text-xs font-bold">Score de Cumplimiento</span></div>
                    <span className="text-xl font-black text-emerald-600">{solicitud.iaResult?.score}%</span>
                  </div>
                  {solicitud.iaResult?.observations.map(obs => (
                    <div key={obs.id} className={cn('p-3 rounded-lg border text-xs', obs.severity === 'ERROR' ? 'bg-red-50 border-red-100 text-red-800' : obs.severity === 'WARNING' ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : 'bg-blue-50 border-blue-100 text-blue-800')}>
                      <div className="flex justify-between font-bold mb-1"><span className="uppercase tracking-tighter">{obs.category}</span><Badge variant={obs.severity === 'ERROR' ? 'destructive' : 'warning'} className="text-[8px] px-1 h-4">{obs.severity}</Badge></div>
                      <p className="leading-relaxed">{obs.message}</p>
                      {obs.suggestion && <div className="mt-2 pt-2 border-t border-current/10"><p className="font-bold mb-0.5">Sugerencia:</p><p className="italic">{obs.suggestion}</p></div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Comentarios tipo blog */}
              {activeTab === 'COMENTARIOS' && (
                <div className="space-y-4">
                  {solicitud.comments.length === 0 && (
                    <div className="text-center py-10 opacity-30"><MessageSquare size={40} className="mx-auto mb-2" /><p className="text-xs">Sin comentarios aún.</p></div>
                  )}
                  {solicitud.comments.map(c => (
                    <div key={c.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-[10px] font-bold">{c.userName.charAt(0)}</div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.userName}</p>
                          <p className="text-[10px] text-slate-400">{c.area} · {formatDate(c.createdAt)}</p>
                        </div>
                      </div>
                      <div className="ml-9 p-3 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{c.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Anotaciones PDF */}
              {activeTab === 'ANOTACIONES' && (
                <div className="space-y-3">
                  {canAnnotate && (
                    <button onClick={() => { setAddingAnnotation(true); }} className="w-full flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-yellow-300 rounded-lg text-xs font-semibold text-yellow-700 hover:bg-yellow-50 transition-colors">
                      <PlusCircle size={16} /> Agregar anotación en el PDF
                    </button>
                  )}
                  {solicitud.annotations.length === 0 && (
                    <div className="text-center py-8 opacity-30"><Pin size={32} className="mx-auto mb-2" /><p className="text-xs">Sin anotaciones.</p></div>
                  )}

                  {/* Anotaciones pendientes (versión actual) */}
                  {solicitud.annotations.filter(a => !a.resolved && (a.version || 1) === solicitud.currentVersion).length > 0 && (
                    <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">Versión actual (v{solicitud.currentVersion})</p>
                  )}
                  {solicitud.annotations.filter(a => !a.resolved && (a.version || 1) === solicitud.currentVersion).map(ann => (
                    <div key={ann.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Pin size={12} className="text-yellow-600" />
                          <span className="text-xs font-bold text-yellow-800">{ann.userName}</span>
                          <Badge className="bg-yellow-200 text-yellow-800 text-[9px] px-1">{ann.area}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-yellow-600">Pág. {ann.page}</span>
                          {canAnnotate && (
                            <button onClick={() => handleResolveAnnotation(ann.id)} className="p-1 hover:bg-emerald-100 text-emerald-500 rounded transition-colors" title="Marcar como resuelta">
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-yellow-900 leading-relaxed cursor-pointer hover:underline" onClick={() => scrollToAnnotation(ann)}>{ann.text}</p>
                      <p className="text-[10px] text-yellow-500">{formatDate(ann.createdAt)}</p>
                    </div>
                  ))}

                  {/* Anotaciones de versiones anteriores (no resueltas) */}
                  {solicitud.annotations.filter(a => !a.resolved && (a.version || 1) < solicitud.currentVersion).length > 0 && (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4">Versiones anteriores</p>
                  )}
                  {solicitud.annotations.filter(a => !a.resolved && (a.version || 1) < solicitud.currentVersion).map(ann => (
                    <div key={ann.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 opacity-70">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Pin size={12} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-500">{ann.userName}</span>
                          <Badge className="bg-slate-200 text-slate-500 text-[9px] px-1">v{ann.version || 1}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Pág. {ann.page}</span>
                          {canAnnotate && (
                            <button onClick={() => handleResolveAnnotation(ann.id)} className="p-1 hover:bg-emerald-100 text-emerald-500 rounded transition-colors" title="Marcar como resuelta">
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed cursor-pointer hover:underline" onClick={() => scrollToAnnotation(ann)}>{ann.text}</p>
                    </div>
                  ))}

                  {/* Anotaciones resueltas */}
                  {solicitud.annotations.filter(a => a.resolved).length > 0 && (
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-4">Resueltas ✓</p>
                  )}
                  {solicitud.annotations.filter(a => a.resolved).map(ann => (
                    <div key={ann.id} className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={12} className="text-emerald-500" />
                          <span className="text-xs font-bold text-emerald-700 line-through">{ann.userName}</span>
                          <Badge className="bg-emerald-200 text-emerald-700 text-[9px] px-1">v{ann.version || 1}</Badge>
                        </div>
                        <span className="text-[10px] text-emerald-500">Resuelta</span>
                      </div>
                      <p className="text-xs text-emerald-600 leading-relaxed line-through">{ann.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Versiones — clickeables para cambiar PDF */}
              {activeTab === 'VERSIONES' && (
                <div className="space-y-2">
                  {[...solicitud.versions].reverse().map(v => (
                    <div
                      key={v.id}
                      className={cn('p-3 rounded-lg border text-xs cursor-pointer transition-colors',
                        viewingVersion === v.version ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 ring-1 ring-amber-300' :
                        v.active && !viewingVersion ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 hover:bg-blue-100' :
                        'bg-slate-50 dark:bg-slate-900 border-slate-200 hover:bg-slate-100')}
                      onClick={() => {
                        if (!v.s3Key) return;
                        if (v.active) loadCurrentVersionPdf();
                        else loadVersionPdf(v.s3Key, v.version);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">v{v.version} — {v.fileName}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {v.active && <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Activa</Badge>}
                          {viewingVersion === v.version && <Badge className="bg-amber-100 text-amber-700 text-[9px]">Viendo</Badge>}
                          {v.s3Key && <span className="text-[9px] text-blue-500">📄 Ver</span>}
                        </div>
                      </div>
                      {v.changeNote && <p className="text-slate-500 italic mb-1 break-words">{v.changeNote}</p>}
                      <p className="text-slate-400">{v.userName} · {formatDate(v.uploadedAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            {/* Input comentario / anotación */}
            {(activeTab === 'COMENTARIOS' || (activeTab === 'ANOTACIONES' && pendingAnnotation)) && (
              <div className="p-4 border-t bg-slate-50 dark:bg-slate-800">
                {activeTab === 'COMENTARIOS' && (
                  <div className="relative">
                    <textarea className="w-full p-3 pr-10 text-xs border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none min-h-[80px] bg-white dark:bg-slate-800" placeholder="Escribe tu comentario..." value={comment} onChange={e => setComment(e.target.value)} />
                    <Button size="icon" className="absolute bottom-3 right-3 h-7 w-7 rounded-full" disabled={!comment.trim()} onClick={handleAddComment}><Send size={14} /></Button>
                  </div>
                )}
                {activeTab === 'ANOTACIONES' && pendingAnnotation && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-1"><Pin size={12} /> Anotación en posición {Math.round(pendingAnnotation.x)}%, {Math.round(pendingAnnotation.y)}%</p>
                    <textarea className="w-full p-3 text-xs border border-yellow-300 rounded-lg focus:ring-1 focus:ring-yellow-400 outline-none min-h-[70px] bg-white dark:bg-slate-800" placeholder="Escribe la observación para este punto del PDF..." value={annotationText} onChange={e => setAnnotationText(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPendingAnnotation(null); setAnnotationText(''); }}>Cancelar</Button>
                      <Button size="sm" className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white gap-1" disabled={!annotationText.trim()} onClick={handleSaveAnnotation}><Pin size={14} /> Guardar</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Brief */}
          <Card className="bg-[#1e3a5f] text-white border-none shadow-lg shrink-0">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center"><FileText size={24} className="text-blue-200" /></div>
              <div><p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Brief</p><p className="text-xs line-clamp-2 text-white/80">{solicitud.description}</p></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RevisionDetailPage;
