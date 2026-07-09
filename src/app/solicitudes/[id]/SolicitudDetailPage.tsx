import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, CheckCircle2, MessageSquare, FileText, Download, FileDown, History, Upload, X, Pin, XCircle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { STATUS_LABELS } from '../../../lib/constants';
import { formatDate, cn } from '../../../lib/utils';
import { Solicitud, Comment, DocumentVersion } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { solicitudesApi } from '../../../lib/api';
import { comentariosApi, versionesApi, anotacionesApi, uploadCommentImage, getImageUrl } from '../../../lib/api';
import PdfViewer from '../../../components/ui/PdfViewer';
import { exportPdfWithAnnotations } from '../../../lib/pdf-export';
import { useDropzone } from 'react-dropzone';

const SolicitudDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const { hasPermission } = useConfig();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [showUploadVersion, setShowUploadVersion] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [activeTab, setActiveTab] = useState<'comentarios' | 'anotaciones' | 'versiones'>('comentarios');
  const [commentAreaFilter, setCommentAreaFilter] = useState<'TODOS' | 'ARA' | 'LEGAL'>('TODOS');
  const [annotationAreaFilter, setAnnotationAreaFilter] = useState<'TODOS' | 'ARA' | 'LEGAL'>('TODOS');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const goToPageRef = useRef<((page: number) => void) | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [addingAnnotation, setAddingAnnotation] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<{ x: number; y: number } | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [editAnnotationText, setEditAnnotationText] = useState('');
  const currentPdfPageRef = useRef(1);

  const { getRootProps: getVersionRootProps, getInputProps: getVersionInputProps, isDragActive: isVersionDragActive } = useDropzone({
    onDrop: (accepted: File[]) => {
      const pdf = accepted.find(f => f.type === 'application/pdf');
      if (pdf) setVersionFile(pdf);
      else notify('Solo se permiten archivos PDF', 'error');
    },
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 52428800,
    maxFiles: 1,
  });

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
        // Filtrar anotaciones: excluir registros fantasma (sin page) y deduplicar
        const rawAnns = anotaciones || s.annotations || [];
        const validAnns = rawAnns.filter((a: any) => a.page != null && a.text);
        const seen = new Set<string>();
        s.annotations = validAnns.filter((a: any) => {
          const key = `${a.page}|${a.x}|${a.y}|${a.text}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
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
    } catch { setSolicitud(null); }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    notify('Datos actualizados', 'success');
  };

  // Load image URLs for comments and annotations that have images
  useEffect(() => {
    if (!solicitud) return;
    const commentKeys = solicitud.comments.filter(c => (c as any).imageKey && !imageUrls[(c as any).imageKey]).map(c => (c as any).imageKey as string);
    const annotationKeys = solicitud.annotations.filter(a => (a as any).imageKey && !imageUrls[(a as any).imageKey]).map(a => (a as any).imageKey as string);
    const keysToLoad = [...new Set([...commentKeys, ...annotationKeys])];
    if (keysToLoad.length === 0) return;
    keysToLoad.forEach(key => {
      getImageUrl(key).then(url => setImageUrls(prev => ({ ...prev, [key]: url }))).catch(() => {});
    });
  }, [solicitud?.comments.length, solicitud?.annotations.length]);

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { notify('Solo se permiten imágenes', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { notify('Máximo 10MB', 'error'); return; }
    setPendingImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setPendingImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) { handleImageSelect(file); e.preventDefault(); }
        break;
      }
    }
  };

  const clearPendingImage = () => { setPendingImage(null); setPendingImagePreview(null); };

  if (!solicitud) return <div>Cargando...</div>;

  const canComment = !!user;
  const canUploadVersion = user?.role === 'SOLICITANTE' || user?.role === 'ADMIN';

  // --- Timeline dinámico basado en aprobaciones reales ---
  const araApproved = solicitud.approvalARA?.approved === true;
  const araRejected = solicitud.approvalARA?.approved === false;
  const legalApproved = solicitud.approvalLegal?.approved === true;
  const legalRejected = solicitud.approvalLegal?.approved === false;
  const isPublicada = solicitud.status === 'PUBLICADA';

  const getStepStatus = (step: string) => {
    switch (step) {
      case 'Enviada':
        return 'completed';
      case 'Revisión ARA':
        if (araRejected) return 'rejected';
        if (araApproved) return 'completed';
        if (solicitud.status === 'EN_REVISION' || solicitud.status === 'ENVIADA') return 'active';
        return 'pending';
      case 'Revisión Legal':
        if (legalRejected) return 'rejected';
        if (legalApproved) return 'completed';
        if (solicitud.status === 'EN_REVISION' || solicitud.status === 'ENVIADA') return 'active';
        return 'pending';
      case 'Publicada':
        if (isPublicada) return 'completed';
        if (araApproved && legalApproved) return 'active';
        return 'pending';
      default:
        return 'pending';
    }
  };

  const timelineSteps = [
    { label: 'Enviada', status: getStepStatus('Enviada'), date: solicitud.createdAt },
    { label: 'Revisión ARA', status: getStepStatus('Revisión ARA'), date: solicitud.approvalARA?.at, by: solicitud.approvalARA?.by },
    { label: 'Revisión Legal', status: getStepStatus('Revisión Legal'), date: solicitud.approvalLegal?.at, by: solicitud.approvalLegal?.by },
    { label: 'Publicada', status: getStepStatus('Publicada'), date: isPublicada ? solicitud.updatedAt : undefined },
  ];

  // --- Filtro de comentarios por área ---
  const filteredComments = solicitud.comments.filter(c => {
    if (commentAreaFilter === 'TODOS') return true;
    const area = (c.area || '').toUpperCase();
    const role = (c.userRole || '').toUpperCase();
    if (commentAreaFilter === 'ARA') return area.includes('ARA') || area.includes('NUTRI') || role === 'REVISOR_ARA';
    if (commentAreaFilter === 'LEGAL') return area.includes('LEGAL') || role === 'REVISOR_LEGAL';
    return true;
  });

  const araCommentsCount = solicitud.comments.filter(c => {
    const area = (c.area || '').toUpperCase();
    const role = (c.userRole || '').toUpperCase();
    return area.includes('ARA') || area.includes('NUTRI') || role === 'REVISOR_ARA';
  }).length;

  const legalCommentsCount = solicitud.comments.filter(c => {
    const area = (c.area || '').toUpperCase();
    const role = (c.userRole || '').toUpperCase();
    return area.includes('LEGAL') || role === 'REVISOR_LEGAL';
  }).length;

  // --- Permiso de anotación desde configuración ---
  const canAnnotate = hasPermission(user?.role || '', 'agregar_anotacion_pdf');

  // --- Guardar anotación ---
  const handleSaveAnnotation = async () => {
    if (!pendingAnnotation || (!annotationText.trim() && !pendingImage) || !user || !solicitud || savingAnnotation) return;
    setSavingAnnotation(true);

    let imageKey: string | undefined;
    if (pendingImage) {
      setUploadingImage(true);
      try { imageKey = await uploadCommentImage(solicitud.id, pendingImage); } catch (e: any) { notify(e.message || 'Error al subir imagen', 'error'); setUploadingImage(false); setSavingAnnotation(false); return; }
      setUploadingImage(false);
    }

    const ann = {
      id: Date.now().toString(),
      solicitudId: solicitud.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      text: annotationText.trim() || (imageKey ? '(ver imagen adjunta)' : ''),
      page: currentPdfPageRef.current,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      createdAt: new Date().toISOString(),
      area: user.area,
      version: solicitud.currentVersion,
      resolved: false,
      imageKey,
    };
    setSolicitud(prev => {
      if (!prev) return prev;
      return { ...prev, annotations: [...prev.annotations, ann] };
    });
    if (imageKey && pendingImagePreview) setImageUrls(prev => ({ ...prev, [imageKey!]: pendingImagePreview! }));
    anotacionesApi.create(solicitud.id, {
      text: ann.text, page: ann.page, x: ann.x, y: ann.y,
      userName: user.name, userRole: user.role, area: user.area || '', userId: user.id, imageKey,
    } as any).catch(console.error).finally(() => setSavingAnnotation(false));
    setAnnotationText('');
    setPendingAnnotation(null);
    setAddingAnnotation(false);
    clearPendingImage();
    notify('Anotación agregada al PDF', 'success');
    setActiveTab('anotaciones');
  };

  const handleEditAnnotation = (annId: string) => {
    const ann = solicitud.annotations.find(a => a.id === annId);
    if (!ann) return;
    setEditingAnnotation(annId);
    setEditAnnotationText(ann.text);
  };

  const handleSaveEditAnnotation = () => {
    if (!editingAnnotation || !editAnnotationText.trim() || !solicitud) return;
    const ann = solicitud.annotations.find(a => a.id === editingAnnotation);
    setSolicitud(prev => {
      if (!prev) return prev;
      return { ...prev, annotations: prev.annotations.map(a => a.id === editingAnnotation ? { ...a, text: editAnnotationText.trim() } : a) };
    });
    const sk = (ann as any)?.sk || `anotaciones#${(ann as any)?.createdAt || ''}#${editingAnnotation}`;
    anotacionesApi.update(solicitud.id, sk, editAnnotationText.trim()).catch(console.error);
    setEditingAnnotation(null);
    setEditAnnotationText('');
    notify('Anotación actualizada', 'success');
  };

  const handleDeleteAnnotation = (annId: string) => {
    if (!solicitud) return;
    const ann = solicitud.annotations.find(a => a.id === annId);
    setSolicitud(prev => {
      if (!prev) return prev;
      return { ...prev, annotations: prev.annotations.filter(a => a.id !== annId) };
    });
    const sk = (ann as any)?.sk || `anotaciones#${(ann as any)?.createdAt || ''}#${annId}`;
    anotacionesApi.delete(solicitud.id, sk).catch(console.error);
    notify('Anotación eliminada', 'info');
  };

  // --- Filtro de anotaciones por área ---
  const isAraAnnotation = (a: { area?: string; userRole?: string }) => {
    const area = (a.area || '').toUpperCase();
    const role = ((a as any).userRole || '').toUpperCase();
    return area.includes('ARA') || area.includes('NUTRI') || role === 'REVISOR_ARA';
  };
  const isLegalAnnotation = (a: { area?: string; userRole?: string }) => {
    const area = (a.area || '').toUpperCase();
    const role = ((a as any).userRole || '').toUpperCase();
    return area.includes('LEGAL') || role === 'REVISOR_LEGAL';
  };
  const filteredAnnotations = solicitud.annotations.filter(a => {
    if (annotationAreaFilter === 'TODOS') return true;
    if (annotationAreaFilter === 'ARA') return isAraAnnotation(a);
    if (annotationAreaFilter === 'LEGAL') return isLegalAnnotation(a);
    return true;
  });
  const araAnnotationsCount = solicitud.annotations.filter(isAraAnnotation).length;
  const legalAnnotationsCount = solicitud.annotations.filter(isLegalAnnotation).length;

  // --- Cargar PDF de una versión específica ---
  const loadVersionPdf = async (s3Key: string, versionNum: number) => {
    const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
    if (!PRESIGN_URL || !s3Key) return;
    try {
      const res = await fetch(PRESIGN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', key: s3Key }),
      });
      const { url } = await res.json();
      if (url) {
        setPdfUrl(url);
        setViewingVersion(versionNum);
      }
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

  const handleAddComment = async () => {
    if ((!newComment.trim() && !pendingImage) || !user) return;
    let imageKey: string | undefined;
    if (pendingImage) {
      setUploadingImage(true);
      try { imageKey = await uploadCommentImage(solicitud!.id, pendingImage); } catch (e: any) { notify(e.message || 'Error al subir imagen', 'error'); setUploadingImage(false); return; }
      setUploadingImage(false);
    }
    try {
      const saved = await comentariosApi.create(solicitud!.id, {
        text: newComment.trim(),
        userName: user.name,
        userRole: user.role,
        area: user.area || '',
        imageKey,
      });
      const comment: Comment = {
        id: saved.id || Date.now().toString(),
        userId: user.id, userName: user.name, userRole: user.role,
        text: newComment.trim(), createdAt: saved.createdAt || new Date().toISOString(), area: user.area,
        imageKey,
      };
      setSolicitud(prev => prev ? { ...prev, comments: [...prev.comments, comment] } : prev);
      if (imageKey && pendingImagePreview) setImageUrls(prev => ({ ...prev, [imageKey!]: pendingImagePreview! }));
      setNewComment('');
      clearPendingImage();
      notify('Comentario agregado', 'success');
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const handleUploadVersion = async () => {
    if (!user || !versionFile) { notify('Selecciona un archivo PDF', 'error'); return; }
    setUploadingVersion(true);
    const nextVersion = solicitud!.currentVersion + 1;
    try {
      const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
      let s3Key = `solicitudes/${solicitud!.id}/v${nextVersion}_${versionFile.name}`;
      if (PRESIGN_URL) {
        const presignRes = await fetch(PRESIGN_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upload', solicitudId: solicitud!.id, fileName: versionFile.name, version: nextVersion }),
        });
        const { url, key } = await presignRes.json();
        if (url) { await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: versionFile }); s3Key = key; }
      }
      // Si es la primera corrección (v2), guarda la v1 original en la tabla de versiones
      if (nextVersion === 2 && solicitud!.files?.[0]) {
        const origFile = solicitud!.files[0] as any;
        try {
          await versionesApi.create(solicitud!.id, {
            s3Key: origFile.s3Key || '', fileName: origFile.name || '', fileSize: origFile.size || 0,
            versionNumber: 1, changeNote: 'Versión original',
          });
        } catch { /* puede que ya exista */ }
      }
      const saved = await versionesApi.create(solicitud!.id, {
        s3Key, fileName: versionFile.name, fileSize: versionFile.size, versionNumber: nextVersion, changeNote: versionNote,
      });
      const newVersion: DocumentVersion = {
        id: saved.id || Date.now().toString(), solicitudId: solicitud!.id,
        s3Key, fileName: versionFile.name, fileSize: versionFile.size,
        version: nextVersion, userId: user.id, userName: user.name,
        uploadedAt: saved.uploadedAt || new Date().toISOString(), active: true, changeNote: versionNote,
      };
      const updatedFiles = [{ id: solicitud!.files[0]?.id || `f-${Date.now()}`, name: versionFile.name, type: 'pdf' as const, url: '', s3Key, size: versionFile.size, uploadedAt: new Date().toISOString(), version: nextVersion }];
      // Si estaba "Con comentarios", al subir pieza final pasa a "Sin comentarios" (lista para publicar)
      // Si estaba rechazada o en revisión, vuelve a ENVIADA para re-revisión
      const newStatus = solicitud!.status === 'APROBADA_OBSERVACIONES' ? 'APROBADA' : 'ENVIADA';
      const nota = solicitud!.status === 'APROBADA_OBSERVACIONES' ? `Pieza final v${nextVersion} subida` : `Corrección v${nextVersion} subida`;
      await solicitudesApi.updateStatus(solicitud!.id, newStatus, nota, updatedFiles, nextVersion);
      setSolicitud(prev => prev ? {
        ...prev, currentVersion: nextVersion, status: newStatus as any,
        versions: [...prev.versions.map(v => ({ ...v, active: false })), newVersion],
        files: updatedFiles,
      } : prev);
      setVersionNote(''); setVersionFile(null); setShowUploadVersion(false);
      notify(solicitud!.status === 'APROBADA_OBSERVACIONES' ? 'Pieza final subida. Ya puedes publicarla.' : `Versión ${nextVersion} subida correctamente`, 'success');
    } catch (e: any) { notify(e.message, 'error'); } finally { setUploadingVersion(false); }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft size={24} /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{solicitud.title}</h1>
              <Badge className={STATUS_LABELS[solicitud.status].color}>{STATUS_LABELS[solicitud.status].label}</Badge>
            </div>
            <p className="text-slate-500 dark:text-slate-400">{solicitud.consecutive} · {solicitud.brand} · {solicitud.product}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="text-slate-400 hover:text-slate-600" title="Actualizar datos">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowVersions(v => !v)}>
            <History size={18} /> v{solicitud.currentVersion} · Versiones
          </Button>
          {canUploadVersion && (solicitud.status === 'RECHAZADA' || solicitud.status === 'EN_REVISION' || solicitud.status === 'APROBADA_OBSERVACIONES') && (
            <Button className="gap-2" onClick={() => setShowUploadVersion(true)} disabled={uploadingVersion}>
              {uploadingVersion ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploadingVersion ? 'Subiendo...' : solicitud.status === 'APROBADA_OBSERVACIONES' ? 'Subir Pieza Final' : 'Subir Corrección'}
            </Button>
          )}
          {(user?.role === 'SOLICITANTE' || user?.role === 'ADMIN') && (solicitud.status === 'APROBADA') && (
            <Button
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={async () => {
                try {
                  await solicitudesApi.updateStatus(solicitud.id, 'PUBLICADA');
                  setSolicitud(prev => prev ? { ...prev, status: 'PUBLICADA' } : prev);
                  notify('Pieza marcada como publicada', 'success');
                } catch (e: any) { notify(e.message, 'error'); }
              }}
            >
              ✓ Marcar como Publicada
            </Button>
          )}
        </div>
      </div>

      {/* Contexto/Descripción */}
      {solicitud.description && (
        <Card className="border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">Contexto / Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{solicitud.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Panel de versiones */}
      {showVersions && (
        <Card className="border-blue-100 bg-blue-50/50 dark:bg-blue-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <History size={16} /> Historial de Versiones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...solicitud.versions].reverse().map(v => (
              <div key={v.id} className={cn('flex items-center justify-between p-3 rounded-lg border text-sm', v.active ? 'bg-white dark:bg-slate-800 border-blue-200' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-70')}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold', v.active ? 'bg-[#1e3a5f] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500')}>
                    v{v.version}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{v.fileName}</p>
                    {v.changeNote && <p className="text-xs text-slate-500 dark:text-slate-400 italic">{v.changeNote}</p>}
                    <p className="text-xs text-slate-400 dark:text-slate-500">{v.userName} · {formatDate(v.uploadedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.active && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Activa</Badge>}
                  <Button variant="ghost" size="sm" className="gap-1 text-blue-600"><Download size={14} /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Modal subir nueva versión */}
      {showUploadVersion && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Upload size={16} /> Subir Nueva Versión (v{solicitud.currentVersion + 1})
            </CardTitle>
            <button onClick={() => setShowUploadVersion(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getVersionRootProps()}
              className={cn('border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isVersionDragActive ? 'border-[#1e3a5f] bg-blue-50' :
                versionFile ? 'border-emerald-400 bg-emerald-50' : 'border-amber-300 hover:border-amber-400 hover:bg-amber-50')}
            >
              <input {...getVersionInputProps()} />
              {versionFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText size={28} className="text-emerald-500" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-emerald-700">{versionFile.name}</p>
                    <p className="text-xs text-emerald-500">{(versionFile.size / 1024 / 1024).toFixed(2)} MB · Listo para subir</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setVersionFile(null); }} className="ml-2 p-1 hover:bg-red-100 text-red-400 rounded-full"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <FileText size={32} className="mx-auto text-amber-400 mb-2" />
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Arrastra el PDF corregido aquí</p>
                  <p className="text-xs text-amber-500 mt-1">o haz clic para seleccionar · Solo PDF · Máx. 50 MB</p>
                </>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nota de cambios (opcional)</label>
              <textarea
                className="w-full p-3 text-sm border rounded-lg focus:ring-1 focus:ring-amber-400 outline-none min-h-[80px] bg-white dark:bg-slate-800"
                placeholder="Describe qué se corrigió en esta versión..."
                value={versionNote}
                onChange={e => setVersionNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowUploadVersion(false)} disabled={uploadingVersion}>Cancelar</Button>
              <Button onClick={handleUploadVersion} className="gap-2" disabled={uploadingVersion || !versionFile}>
                {uploadingVersion ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadingVersion ? 'Subiendo...' : 'Subir Versión'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline — flujo real: Enviada → ARA → Legal → Publicada */}
      <Card className="border-none shadow-sm bg-white dark:bg-slate-800">
        <CardContent className="p-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-700 z-0" />
            {timelineSteps.map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-2 relative z-10 bg-white dark:bg-slate-800 px-2">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-colors',
                  step.status === 'completed' ? 'bg-emerald-500 text-white' :
                  step.status === 'rejected' ? 'bg-red-500 text-white' :
                  step.status === 'active' ? 'bg-[#1e3a5f] text-white animate-pulse' :
                  'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500')}>
                  {step.status === 'completed' ? <CheckCircle2 size={20} /> :
                   step.status === 'rejected' ? <XCircle size={20} /> :
                   step.status === 'active' ? <Clock size={20} /> : i + 1}
                </div>
                <div className="text-center">
                  <p className={cn('text-[10px] font-bold uppercase tracking-wider',
                    step.status === 'completed' ? 'text-emerald-600' :
                    step.status === 'rejected' ? 'text-red-600' :
                    step.status === 'active' ? 'text-[#1e3a5f]' :
                    'text-slate-400 dark:text-slate-500')}>{step.label}</p>
                  {step.date && <p className="text-[9px] text-slate-400 dark:text-slate-500">{formatDate(step.date)}</p>}
                  {(step as any).by && <p className="text-[9px] text-slate-400 dark:text-slate-500">{(step as any).by}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Estado de aprobación por área — visible para el solicitante */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ARA */}
        <Card className={cn('border-2 transition-colors',
          araApproved ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10' :
          araRejected ? 'border-red-200 bg-red-50/50 dark:bg-red-900/10' :
          'border-slate-200 bg-slate-50/50 dark:bg-slate-800')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Revisión ARA & Nutrición</p>
              {araApproved && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">✓ Aprobada</Badge>}
              {araRejected && <Badge className="bg-red-100 text-red-700 text-[10px]">✗ Rechazada</Badge>}
              {!solicitud.approvalARA && <Badge className="bg-slate-100 text-slate-500 text-[10px]">Pendiente</Badge>}
            </div>
            {solicitud.approvalARA && (
              <div className="space-y-1">
                <p className="text-sm text-slate-700 dark:text-slate-300">Por: {solicitud.approvalARA.by}</p>
                <p className="text-xs text-slate-400">{formatDate(solicitud.approvalARA.at)}</p>
                {solicitud.approvalARA.nota && <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-1">"{solicitud.approvalARA.nota}"</p>}
              </div>
            )}
            {araCommentsCount > 0 && (
              <button
                onClick={() => { setActiveTab('comentarios'); setCommentAreaFilter('ARA'); }}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
              >
                Ver {araCommentsCount} comentario{araCommentsCount > 1 ? 's' : ''} de ARA →
              </button>
            )}
          </CardContent>
        </Card>

        {/* Legal */}
        <Card className={cn('border-2 transition-colors',
          legalApproved ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10' :
          legalRejected ? 'border-red-200 bg-red-50/50 dark:bg-red-900/10' :
          'border-slate-200 bg-slate-50/50 dark:bg-slate-800')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Revisión Legal</p>
              {legalApproved && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">✓ Aprobada</Badge>}
              {legalRejected && <Badge className="bg-red-100 text-red-700 text-[10px]">✗ Rechazada</Badge>}
              {!solicitud.approvalLegal && <Badge className="bg-slate-100 text-slate-500 text-[10px]">Pendiente</Badge>}
            </div>
            {solicitud.approvalLegal && (
              <div className="space-y-1">
                <p className="text-sm text-slate-700 dark:text-slate-300">Por: {solicitud.approvalLegal.by}</p>
                <p className="text-xs text-slate-400">{formatDate(solicitud.approvalLegal.at)}</p>
                {solicitud.approvalLegal.nota && <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-1">"{solicitud.approvalLegal.nota}"</p>}
              </div>
            )}
            {legalCommentsCount > 0 && (
              <button
                onClick={() => { setActiveTab('comentarios'); setCommentAreaFilter('LEGAL'); }}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
              >
                Ver {legalCommentsCount} comentario{legalCommentsCount > 1 ? 's' : ''} de Legal →
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Visor PDF */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText size={18} className="text-red-500" />
                {solicitud.files[0]?.name}
                <Badge className={cn('text-[10px]', viewingVersion ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300')}>
                  {viewingVersion ? `v${viewingVersion} (anterior)` : `v${solicitud.currentVersion}`}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {viewingVersion && (
                  <Button variant="outline" size="sm" className="gap-1 text-xs text-amber-700 border-amber-300 hover:bg-amber-50" onClick={loadCurrentVersionPdf}>
                    Volver a v{solicitud.currentVersion}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-2 text-blue-600" onClick={async () => {
                  if (!pdfUrl) return;
                  try {
                    const pdfBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
                      const xhr = new XMLHttpRequest();
                      xhr.open('GET', pdfUrl, true);
                      xhr.responseType = 'arraybuffer';
                      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response) : reject(new Error('Error'));
                      xhr.onerror = () => reject(new Error('Error de red'));
                      xhr.send();
                    });
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = `${solicitud.consecutive}_${solicitud.createdAt ? new Date(solicitud.createdAt).toISOString().slice(0, 10) : ''}_${solicitud.files?.[0]?.name && !solicitud.files[0].name.match(/^[0-9a-f-]{36}/) ? solicitud.files[0].name : (solicitud.title || 'documento') + '.pdf'}`;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 5000);
                  } catch { window.open(pdfUrl, '_blank'); }
                }} disabled={!pdfUrl}>
                  <Download size={16} /> Descargar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-emerald-600"
                  disabled={!pdfUrl || solicitud.annotations.length === 0}
                  onClick={async () => {
                    const s3Key = (solicitud.files?.[0] as any)?.s3Key;
                    if (!s3Key && !pdfUrl) { notify('No hay PDF disponible', 'error'); return; }
                    try {
                      notify('Generando PDF con comentarios...', 'info');
                      await exportPdfWithAnnotations(
                        s3Key || pdfUrl!,
                        solicitud.annotations.map(a => ({
                          id: a.id, page: a.page, x: a.x, y: a.y,
                          x2: a.x2, y2: a.y2,
                          text: a.text || '(sin texto)', userName: a.userName || 'Revisor', area: a.area || '',
                          tool: a.tool, color: a.color, resolved: a.resolved,
                        })),
                        `${solicitud.consecutive}_${solicitud.createdAt ? new Date(solicitud.createdAt).toISOString().slice(0, 10) : ''}${solicitud.files?.[0]?.name && !solicitud.files[0].name.match(/^[0-9a-f-]{36}/) ? '_' + solicitud.files[0].name.replace('.pdf', '') : '_' + (solicitud.title || 'documento')}_comentarios.pdf`
                      );
                      notify('PDF exportado con comentarios', 'success');
                    } catch (e: any) {
                      notify(e.message || 'Error al exportar', 'error');
                    }
                  }}
                >
                  <FileDown size={16} /> Exportar con comentarios
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative">
              <PdfViewer
                url={pdfUrl}
                fileName={solicitud.files[0]?.name}
                className="min-h-[600px]"
                annotations={solicitud.annotations.map(a => ({
                  id: a.id, page: a.page, x: a.x, y: a.y,
                  text: a.text, userName: a.userName, area: a.area,
                }))}
                goToPageRef={goToPageRef}
                canAnnotate={canAnnotate}
                annotating={addingAnnotation}
                showToolbar={true}
                onToggleAnnotating={() => { setAddingAnnotation(v => !v); setPendingAnnotation(null); }}
                onAnnotationClick={(page, x, y) => { if (addingAnnotation) { setPendingAnnotation({ x, y }); currentPdfPageRef.current = page; } }}
                onPageChange={(page) => { currentPdfPageRef.current = page; }}
                pendingPin={pendingAnnotation}
                pendingPinAnnotation={!!pendingAnnotation}
                pinAnnotationText={annotationText}
                onPinTextChange={setAnnotationText}
                onPinSave={handleSaveAnnotation}
                onPinCancel={() => { setPendingAnnotation(null); setAnnotationText(''); }}
              />
            </CardContent>
          </Card>

          {/* Info solicitud */}
          <Card>
            <CardHeader><CardTitle className="text-lg font-bold">Información de la Solicitud</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Marca / Asunto</p><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{solicitud.brand} - {solicitud.product}</p></div>
                <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tipo de Contenido</p><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{solicitud.contentType.replace('_', ' ')}</p></div>
                <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Solicitante</p><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{solicitud.solicitanteName}</p></div>
                <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Área</p><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{solicitud.area}</p></div>
                <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Fecha Límite</p><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDate(solicitud.deadline)}</p></div>
                <div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Número de piezas</p><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{solicitud.numeroPiezas || 1}</p></div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Descripción / Brief</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{solicitud.description}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel derecho — sin pre-validación IA */}
        <div className="space-y-6 min-w-0">
          {/* Tabs: comentarios / anotaciones / versiones */}
          <Card className="overflow-hidden">
            <div className="flex border-b">
              {(['comentarios', 'anotaciones', 'versiones'] as const).map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'comentarios') setCommentAreaFilter('TODOS'); }} className={cn('flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors', activeTab === tab ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-400 hover:text-slate-600')}>
                  {tab === 'comentarios' ? `Comentarios (${solicitud.comments.length})` : tab === 'anotaciones' ? `Anotaciones (${solicitud.annotations.length})` : `Versiones (${solicitud.versions.length})`}
                </button>
              ))}
            </div>

            <CardContent className="p-4 space-y-4 overflow-hidden">
              {/* Comentarios con filtro por área */}
              {activeTab === 'comentarios' && (
                <>
                  {/* Filtro por área */}
                  <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {([
                      { key: 'TODOS' as const, label: 'Todos', count: solicitud.comments.length },
                      { key: 'ARA' as const, label: 'ARA', count: araCommentsCount },
                      { key: 'LEGAL' as const, label: 'Legal', count: legalCommentsCount },
                    ]).map(f => (
                      <button
                        key={f.key}
                        onClick={() => setCommentAreaFilter(f.key)}
                        className={cn('flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors',
                          commentAreaFilter === f.key
                            ? 'bg-white dark:bg-slate-700 text-[#1e3a5f] shadow-sm'
                            : 'text-slate-400 hover:text-slate-600')}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                    {filteredComments.length === 0 && (
                      <div className="text-center py-8 opacity-40"><MessageSquare size={32} className="mx-auto mb-2" /><p className="text-xs">Sin comentarios{commentAreaFilter !== 'TODOS' ? ` de ${commentAreaFilter}` : ''}.</p></div>
                    )}
                    {filteredComments.map(c => (
                      <div key={c.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                              (c.userRole === 'REVISOR_LEGAL' || (c.area || '').toUpperCase().includes('LEGAL')) ? 'bg-purple-600' :
                              (c.userRole === 'REVISOR_ARA' || (c.area || '').toUpperCase().includes('ARA')) ? 'bg-blue-600' :
                              'bg-[#1e3a5f]'
                            )}>{c.userName.charAt(0)}</div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.userName}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                {c.area || (c.userRole === 'REVISOR_ARA' ? 'ARA & Nutrición' : c.userRole === 'REVISOR_LEGAL' ? 'Legal' : 'Solicitante')} · {formatDate(c.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-9 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 border leading-relaxed break-words overflow-hidden">
                          {c.text}
                          {(c as any).imageKey && imageUrls[(c as any).imageKey] && (
                            <div className="mt-2">
                              <img src={imageUrls[(c as any).imageKey]} alt="Imagen adjunta" className="max-w-full max-h-48 rounded-lg border border-slate-200 cursor-pointer hover:opacity-90" onClick={() => window.open(imageUrls[(c as any).imageKey], '_blank')} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {canComment && (
                    <div className="pt-3 border-t space-y-2">
                      <textarea className="w-full p-3 text-sm border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none min-h-[80px] bg-white dark:bg-slate-800" placeholder="Escribe un comentario... (Ctrl+V para pegar imagen)" value={newComment} onChange={e => setNewComment(e.target.value)} onPaste={handlePaste} />
                      {pendingImagePreview && (
                        <div className="relative inline-block">
                          <img src={pendingImagePreview} alt="Preview" className="max-h-20 rounded-lg border border-blue-200" />
                          <button onClick={clearPendingImage} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-600 shadow">✕</button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImageSelect(e.target.files[0]); e.target.value = ''; }} />
                          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors">
                            <ImageIcon size={14} /> 📷 Adjuntar imagen
                          </button>
                        </div>
                        <Button size="sm" onClick={handleAddComment} disabled={(!newComment.trim() && !pendingImage) || uploadingImage}>
                          {uploadingImage ? 'Subiendo...' : 'Agregar Comentario'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Anotaciones PDF con filtro por área */}
              {activeTab === 'anotaciones' && (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {/* Input anotación pendiente */}
                  {canAnnotate && pendingAnnotation && (
                    <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg space-y-2">
                      <p className="text-[11px] font-bold text-yellow-800">📌 Anotación en Pág. {currentPdfPageRef.current}</p>
                      <textarea
                        value={annotationText}
                        onChange={e => setAnnotationText(e.target.value)}
                        placeholder="Escribe tu observación..."
                        className="w-full border rounded-lg p-2 text-sm resize-none focus:ring-2 focus:ring-yellow-400"
                        rows={3}
                        autoFocus
                      />
                      {pendingImagePreview && (
                        <div className="relative inline-block">
                          <img src={pendingImagePreview} alt="Preview" className="max-h-20 rounded border" />
                          <button onClick={clearPendingImage} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">×</button>
                        </div>
                      )}
                      <div className="flex gap-2 items-center">
                        <Button size="sm" onClick={handleSaveAnnotation} disabled={(!annotationText.trim() && !pendingImage) || savingAnnotation}>
                          {savingAnnotation ? 'Guardando...' : 'Guardar'}
                        </Button>
                        <button type="button" onClick={() => imageInputRef.current?.click()} className="p-1.5 hover:bg-yellow-100 rounded transition-colors" title="Adjuntar imagen">
                          <ImageIcon size={16} className="text-yellow-700" />
                        </button>
                        <Button size="sm" variant="ghost" onClick={() => { setPendingAnnotation(null); setAnnotationText(''); clearPendingImage(); }}>Cancelar</Button>
                      </div>
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { const f = e.target.files[0]; if (f.size > 10*1024*1024) { notify('Máximo 10MB', 'error'); return; } setPendingImage(f); const reader = new FileReader(); reader.onload = ev => setPendingImagePreview(ev.target?.result as string); reader.readAsDataURL(f); } }} />
                    </div>
                  )}
                  {canAnnotate && addingAnnotation && !pendingAnnotation && (
                    <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 text-center">
                      👆 Haz clic en el PDF para colocar la anotación
                    </div>
                  )}
                  {/* Filtro por área */}
                  <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {([
                      { key: 'TODOS' as const, label: 'Todas', count: solicitud.annotations.length },
                      { key: 'ARA' as const, label: 'ARA', count: araAnnotationsCount },
                      { key: 'LEGAL' as const, label: 'Legal', count: legalAnnotationsCount },
                    ]).map(f => (
                      <button
                        key={f.key}
                        onClick={() => setAnnotationAreaFilter(f.key)}
                        className={cn('flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors',
                          annotationAreaFilter === f.key
                            ? 'bg-white dark:bg-slate-700 text-[#1e3a5f] shadow-sm'
                            : 'text-slate-400 hover:text-slate-600')}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>

                  {filteredAnnotations.length === 0 && (
                    <div className="text-center py-8 opacity-40"><Pin size={32} className="mx-auto mb-2" /><p className="text-xs">Sin anotaciones{annotationAreaFilter !== 'TODOS' ? ` de ${annotationAreaFilter}` : ''}.</p></div>
                  )}
                  {filteredAnnotations.map(ann => (
                    <div key={ann.id} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => goToPageRef.current?.(ann.page)}>
                          <Pin size={14} className="text-yellow-600" />
                          <span className="text-xs font-bold text-yellow-800 dark:text-yellow-300">{
                            ann.userRole === 'REVISOR_ARA' ? 'Revisor ARA & Nutrición'
                            : ann.userRole === 'REVISOR_LEGAL' ? 'Revisor Legal'
                            : ann.area?.toLowerCase().includes('regulat') ? 'Revisor ARA & Nutrición'
                            : ann.area?.toLowerCase().includes('legal') ? 'Revisor Legal'
                            : ann.userName || (ann.area ? `Revisor ${ann.area}` : 'Comité')
                          }</span>
                          <Badge className="bg-yellow-200 text-yellow-800 text-[9px] px-1">{ann.area || (ann.userRole === 'REVISOR_ARA' ? 'ARA' : ann.userRole === 'REVISOR_LEGAL' ? 'Legal' : '')}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-yellow-600 dark:text-yellow-400">Pág. {ann.page}</span>
                          {canAnnotate && (ann.userId === user?.id || ann.userName === user?.name) && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleEditAnnotation(ann.id); }} className="p-1 hover:bg-blue-100 text-blue-400 rounded transition-colors" title="Editar">
                                <MessageSquare size={12} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteAnnotation(ann.id); }} className="p-1 hover:bg-red-100 text-red-400 rounded transition-colors" title="Eliminar">
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingAnnotation === ann.id ? (
                        <div className="space-y-2">
                          <textarea value={editAnnotationText} onChange={e => setEditAnnotationText(e.target.value)} className="w-full border rounded-lg p-2 text-sm resize-none focus:ring-2 focus:ring-yellow-400" rows={2} autoFocus />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEditAnnotation} disabled={!editAnnotationText.trim()}>Guardar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingAnnotation(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-yellow-900 dark:text-yellow-200 leading-relaxed break-words">{ann.text}</p>
                          {(ann as any).imageKey && imageUrls[(ann as any).imageKey] && (
                            <img src={imageUrls[(ann as any).imageKey]} alt="Adjunto" className="mt-2 max-h-32 rounded-lg border" />
                          )}
                        </>
                      )}
                      <p className="text-[10px] text-yellow-500 dark:text-yellow-500">{formatDate(ann.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Versiones — click para ver PDF de esa versión */}
              {activeTab === 'versiones' && (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {[...solicitud.versions].reverse().map(v => (
                    <div
                      key={v.id}
                      className={cn('p-3 rounded-lg border text-xs cursor-pointer transition-colors',
                        viewingVersion === v.version ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 ring-1 ring-amber-300' :
                        v.active && !viewingVersion ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 hover:bg-blue-100' :
                        'bg-slate-50 dark:bg-slate-900 border-slate-200 hover:bg-slate-100 opacity-70')}
                      onClick={() => {
                        if (!v.s3Key) return;
                        if (v.active) {
                          loadCurrentVersionPdf();
                        } else {
                          loadVersionPdf(v.s3Key, v.version);
                        }
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
                      {v.changeNote && <p className="text-slate-500 dark:text-slate-400 italic mb-1 break-words">{v.changeNote}</p>}
                      <p className="text-slate-400 dark:text-slate-500">{v.userName} · {formatDate(v.uploadedAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SolicitudDetailPage;
