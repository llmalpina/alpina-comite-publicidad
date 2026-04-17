import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Upload, FileText, CheckCircle2, X, Info, ShieldCheck, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardFooter } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useMaestros } from '../../../contexts/MaestrosContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { useDropzone } from 'react-dropzone';
import { cn } from '../../../lib/utils';
import { analizarConBedrock, BedrockResult } from '../../../lib/services';
import { solicitudesApi } from '../../../lib/api';
import { Solicitud } from '../../../types';

const STEPS = [
  { id: 1, title: 'Información Básica' },
  { id: 2, title: 'Archivos PDF' },
  { id: 3, title: 'Detalles' },
  { id: 4, title: 'Pre-validación IA' },
];

const NuevaSolicitudPage: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const { config: maestros } = useMaestros();
  const { user } = useAuth();
  const { canSubmitNow, emailConfig } = useConfig();

  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedS3Keys, setUploadedS3Keys] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [iaResult, setIaResult] = useState<BedrockResult | null>(null);
  const [iaError, setIaError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [brand, setBrand] = useState<string[]>([]);
  const [product, setProduct] = useState('');
  const [contentType, setContentType] = useState('');
  const [channel, setChannel] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');

  const marcasActivas = maestros.marcas.filter(m => m.activo);
  const tiposActivos = maestros.tiposContenido.filter(t => t.activo);
  const canalesActivos = maestros.canales.filter(c => c.activo);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted: File[]) => {
      const pdfs = accepted.filter(f => f.type === 'application/pdf');
      if (pdfs.length < accepted.length) notify('Solo se permiten archivos PDF', 'error');
      setFiles(prev => [...prev, ...pdfs]);
    },
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 52428800,
  });

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const runBedrock = async () => {
    if (!files[0]) return;
    // Verificar si IA está habilitada
    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL;
      if (apiUrl) {
        const configRes = await fetch(`${apiUrl}/maestros/config-ia-model`, {
          headers: { ...(localStorage.getItem('alpina_id_token') ? { Authorization: `Bearer ${localStorage.getItem('alpina_id_token')}` } : {}) },
        });
        const items = await configRes.json();
        const cfg = items.find((i: any) => i.id === 'singleton');
        if (cfg?.enabled === false) {
          setIaResult(null);
          setAnalyzing(false);
          return;
        }
        // Verificar si el tipo de contenido tiene IA habilitada
        if (cfg?.byContentType && cfg.byContentType[contentType] === false) {
          setIaResult(null);
          setAnalyzing(false);
          return;
        }
      }
    } catch { /* continuar con análisis */ }
    setAnalyzing(true);
    setIaError(null);
    try {
      const result = await analizarConBedrock(files[0], { brand: brand.join(', '), product, channel, contentType, description }, maestros.promptIA, uploadedS3Keys[0]);
      setIaResult(result);
    } catch (e: any) {
      setIaError(e.message || 'Error al analizar');
    } finally {
      setAnalyzing(false);
    }
  };

  const [uploading, setUploading] = useState(false);

  const handleNext = async () => {
    if (step === 1 && (!brand.length || !product || !contentType || !channel)) {
      notify('Completa todos los campos obligatorios', 'error'); return;
    }
    if (step === 2 && files.length === 0) {
      notify('Debes subir al menos un archivo PDF', 'error'); return;
    }
    // Al pasar del paso 2 al 3: subir PDF a S3 + lanzar IA en paralelo
    if (step === 2 && uploadedS3Keys.length === 0) {
      setUploading(true);
      const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
      if (PRESIGN_URL) {
        try {
          const keys: string[] = [];
          for (const f of files) {
            const presignRes = await fetch(PRESIGN_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'upload', solicitudId: `temp-${Date.now()}`, fileName: f.name, version: 1 }),
            });
            const { url, key } = await presignRes.json();
            if (url) { await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: f }); keys.push(key); }
          }
          setUploadedS3Keys(keys);
          setUploading(false);
          // Verificar si IA está habilitada para este tipo de contenido
          let shouldAnalyze = true;
          try {
            const apiUrl = (import.meta as any).env?.VITE_API_URL;
            if (apiUrl) {
              const cfgRes = await fetch(`${apiUrl}/maestros/config-ia-model`, {
                headers: { ...(localStorage.getItem('alpina_id_token') ? { Authorization: `Bearer ${localStorage.getItem('alpina_id_token')}` } : {}) },
              });
              if (cfgRes.ok) {
                const items = await cfgRes.json();
                const cfg = items.find((i: any) => i.id === 'singleton');
                if (cfg?.enabled === false) shouldAnalyze = false;
                if (cfg?.byContentType && cfg.byContentType[contentType] === false) shouldAnalyze = false;
              }
            }
          } catch { /* continuar */ }
          // Lanzar IA en background si está habilitada
          if (shouldAnalyze && keys[0]) {
            setAnalyzing(true);
            setIaError(null);
            analizarConBedrock(files[0], { brand: brand.join(', '), product, channel, contentType, description }, maestros.promptIA, keys[0])
              .then(result => setIaResult(result))
              .catch(e => setIaError(e.message || 'Error al analizar'))
              .finally(() => setAnalyzing(false));
          }
        } catch {
          setUploading(false);
        }
      } else {
        setUploading(false);
      }
    }
    if (step === 3) { setStep(4); return; }
    if (step === 4) { await handleSubmit(); return; }
    setStep(s => s + 1);
  };

  const handleBack = () => { if (step > 1) setStep(s => s - 1); };

  const handleSubmit = async () => {
    if (!confirmed) { notify('Confirma que revisaste las observaciones', 'error'); return; }
    // Validar horario de envío
    const scheduleCheck = canSubmitNow(user?.role || 'SOLICITANTE');
    if (!scheduleCheck.allowed) {
      notify(scheduleCheck.message || 'Fuera del horario de envío', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;

      // 1. Usar s3Keys ya subidos en paso 2, o subir si no se subieron
      const uploadedFiles = await Promise.all(files.map(async (f, i) => {
        let s3Key = uploadedS3Keys[i] || '';
        let s3Url = s3Key ? `https://alpina-comitepublicidad-docs-prod.s3.amazonaws.com/${s3Key}` : '';
        if (!s3Key && PRESIGN_URL) {
          try {
            const presignRes = await fetch(PRESIGN_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'upload', solicitudId: `temp-${Date.now()}`, fileName: f.name, version: 1 }),
            });
            const { url, key } = await presignRes.json();
            // Subimos el archivo directo a S3
            await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: f });
            s3Key = key;
            s3Url = `https://alpina-analytics-prod-us-east-1-586139298250-silver.s3.amazonaws.com/${key}`;
          } catch (uploadErr) {
            console.warn('No se pudo subir a S3, continuando sin URL:', uploadErr);
          }
        }
        return {
          id: `f-${Date.now()}-${i}`, name: f.name, type: 'pdf' as const,
          url: s3Url, s3Key, size: f.size, uploadedAt: now, version: 1,
        };
      }));

      const solicitudData = {
        title: `${brand.join(', ')} — ${product}`,
        description, brand: brand.join(', '), product, contentType, channel,
        deadline: deadline || new Date(Date.now() + 7 * 86400000).toISOString(),
        iaResult: iaResult ?? undefined,
        files: uploadedFiles,
        annotations: [], comments: [], currentVersion: 1, versions: [],
        solicitanteName: user?.name || '',
        solicitanteEmail: user?.email || '',
        area: user?.area || '',
      };

      let solicitud: Solicitud;
      solicitud = await solicitudesApi.create(solicitudData);

      // Enviar correo de nueva solicitud a los revisores (usa reglas configuradas)
      const SES_URL = (import.meta as any).env?.VITE_SES_LAMBDA_URL as string;
      if (SES_URL) {
        const rule = emailConfig.rules.find(r => r.event === 'solicitud_creada' && r.enabled);
        const extraTo = rule?.toEmails || [];
        const extraCc = rule?.cc || ['nicolas.carreno@alpina.com'];
        const defaultTo = ['nicolas.carreno@alpina.com'];
        const to = [...new Set([...defaultTo, ...extraTo])];
        const token = localStorage.getItem('alpina_id_token');
        fetch(SES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            template: 'nueva_solicitud',
            to,
            cc: extraCc,
            data: {
              id: solicitud.id, consecutive: solicitud.consecutive, title: solicitud.title,
              brand: brand.join(', '), area: user?.area || '', solicitanteName: user?.name || '',
              deadline: solicitudData.deadline,
            },
          }),
        }).catch(console.error);
      }

      notify(`Solicitud ${solicitud.consecutive} enviada al comité`, 'success');
      navigate('/solicitudes');
    } catch (e: any) {
      console.error('[NuevaSolicitud]', e);
      notify(e.message || 'Error al enviar la solicitud', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const severityColor = (s: string) =>
    s === 'ERROR' ? 'bg-red-50 border-red-200 text-red-800' :
    s === 'WARNING' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
    'bg-blue-50 border-blue-200 text-blue-800';

  // Verificar horario al cargar la página
  const scheduleStatus = canSubmitNow(user?.role || 'SOLICITANTE');

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nueva Solicitud</h1>
          <p className="text-slate-500 dark:text-slate-400">Completa los pasos para enviar tu pieza a revisión.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/solicitudes')}>Cancelar</Button>
      </div>

      {!scheduleStatus.allowed && (
        <div className="flex items-center gap-4 p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <Clock size={24} className="text-red-600" />
          </div>
          <div>
            <p className="font-bold text-red-800 dark:text-red-300">Fuera del horario de envío</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{scheduleStatus.message}</p>
            <Button variant="outline" size="sm" className="mt-3 text-red-600 border-red-300" onClick={() => navigate('/solicitudes')}>
              Volver a mis solicitudes
            </Button>
          </div>
        </div>
      )}

      {scheduleStatus.allowed && (<>

      {/* Stepper */}
      <div className="flex items-center justify-between px-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors',
                step >= s.id ? 'bg-[#1e3a5f] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500')}>
                {step > s.id ? <CheckCircle2 size={20} /> : s.id}
              </div>
              <span className={cn('text-xs font-medium', step >= s.id ? 'text-[#1e3a5f]' : 'text-slate-400')}>{s.title}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-4 -mt-6', step > s.id ? 'bg-[#1e3a5f]' : 'bg-slate-200 dark:bg-slate-700')} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card className="shadow-lg border-none">
        <CardContent className="p-8">

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Marca(s) *</label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px] bg-background">
                    {brand.map(b => (
                      <span key={b} className="flex items-center gap-1 bg-[#1e3a5f] text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                        {b}
                        <button type="button" onClick={() => setBrand(prev => prev.filter(x => x !== b))} className="hover:text-red-300">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <select
                      value=""
                      onChange={e => { if (e.target.value && !brand.includes(e.target.value)) setBrand(prev => [...prev, e.target.value]); }}
                      className="flex-1 min-w-[120px] h-8 bg-transparent text-sm outline-none border-none"
                    >
                      <option value="">{brand.length === 0 ? 'Selecciona marca(s)' : 'Agregar otra...'}</option>
                      {marcasActivas.filter(m => !brand.includes(m.value)).map(m => <option key={m.id} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Producto *</label>
                  <Input placeholder="Ej: Bon Yurt Original 170g" value={product} onChange={e => setProduct(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tipo de Contenido *</label>
                  <select value={contentType} onChange={e => setContentType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Selecciona tipo</option>
                    {tiposActivos.map(t => <option key={t.id} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Canal de Publicación *</label>
                  <select value={channel} onChange={e => setChannel(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Selecciona canal</option>
                    {canalesActivos.map(c => <option key={c.id} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción / Brief</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Describe el objetivo de la pieza y contexto relevante..." />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div {...getRootProps()} className={cn('border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
                isDragActive ? 'border-[#1e3a5f] bg-blue-50' : 'border-slate-300 dark:border-slate-600 hover:border-[#1e3a5f] hover:bg-slate-50 dark:bg-slate-800')}>
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-[#1e3a5f]"><Upload size={32} /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Arrastra tu PDF aquí</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2">O haz clic para seleccionar desde tu equipo</p>
                <Badge variant="outline" className="mt-4 bg-white dark:bg-slate-800">Solo archivos PDF · Máx. 50 MB</Badge>
              </div>
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded border flex items-center justify-center text-red-500"><FileText size={20} /></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={() => removeFile(i)} className="p-1 hover:bg-red-100 text-red-500 rounded-full"><X size={18} /></button>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha Límite Deseada</label>
                <div
                  className="flex items-center gap-3 h-12 w-full rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 cursor-pointer hover:border-[#1e3a5f] transition-colors focus-within:border-[#1e3a5f] focus-within:ring-2 focus-within:ring-[#1e3a5f]/20"
                  onClick={() => { const el = document.getElementById('deadline-input') as HTMLInputElement; el?.showPicker?.(); el?.focus(); }}
                >
                  <span className="text-slate-400 text-lg">📅</span>
                  <input
                    id="deadline-input"
                    type="date"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none cursor-pointer w-full"
                  />
                </div>
                <p className="text-xs text-slate-400">Sujeto a disponibilidad de la bolsa de horas.</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {analyzing ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                    <Loader2 size={40} className="text-[#1e3a5f] animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Analizando con Amazon Bedrock...</h3>
                  <p className="text-slate-500">Claude está revisando tu pieza según el ABC de Publicidad Alpina.</p>
                </div>
              ) : iaError ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle size={40} className="text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Análisis no disponible</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">Configura <code className="bg-slate-100 px-1 rounded">VITE_BEDROCK_LAMBDA_URL</code> en .env.local para activar el análisis.</p>
                </div>
              ) : iaResult ? (
                <>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center shrink-0',
                      iaResult.score >= 80 ? 'bg-emerald-100 text-emerald-600' :
                      iaResult.score >= 60 ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-600')}>
                      <span className="text-2xl font-black">{iaResult.score}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Pre-validación completada</p>
                      <p className="text-xs text-slate-500">
                        {iaResult.observations.length === 0 ? 'No se encontraron observaciones. Tu pieza se ve bien.' :
                         `Se encontraron ${iaResult.observations.length} sugerencia${iaResult.observations.length > 1 ? 's' : ''} para revisar.`}
                      </p>
                    </div>
                  </div>
                  {iaResult.observations.length > 0 && (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {iaResult.observations.map(obs => (
                        <div key={obs.id} className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-lg">
                          <div className="w-1.5 rounded-full shrink-0 bg-amber-400" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-bold text-amber-700 uppercase">{obs.category}</span>
                              <span className="text-[10px] text-amber-500">Sugerencia</span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{obs.message}</p>
                            {obs.suggestion && <p className="text-[11px] text-amber-600 mt-1 italic">{obs.suggestion}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 text-center">Este análisis es una sugerencia automática. La decisión final la toma el comité.</p>
                </>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sin análisis previo</h3>
                  <p className="text-sm text-slate-500">Configura <code className="bg-slate-100 px-1 rounded">VITE_BEDROCK_LAMBDA_URL</code> para activar el análisis automático.</p>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                <input type="checkbox" id="confirm" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#1e3a5f] focus:ring-[#1e3a5f]" />
                <label htmlFor="confirm" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  Confirmo que esta es la versión final de la pieza y he revisado las observaciones.
                </label>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-slate-50 dark:bg-slate-800 p-6 flex justify-between border-t rounded-b-lg">
          <Button variant="outline" onClick={handleBack} disabled={step === 1 || analyzing || submitting} className="gap-2">
            <ChevronLeft size={18} /> Anterior
          </Button>
          <Button onClick={handleNext} disabled={analyzing || submitting || uploading} className="gap-2">
            {uploading   ? <><Loader2 size={16} className="animate-spin" /> Subiendo PDF...</> :
             submitting  ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> :
             analyzing   ? <><Loader2 size={16} className="animate-spin" /> Analizando...</> :
             step === 4  ? 'Enviar al Comité' :
                           <>Siguiente <ChevronRight size={18} /></>}
          </Button>
        </CardFooter>
      </Card>
      </>)}
    </div>
  );
};

export default NuevaSolicitudPage;
