import React, { useState, useCallback } from 'react';
import { Upload, FileText, Sparkles, Save, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useManualConfig } from '../../../hooks/useManualConfig';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useDropzone } from 'react-dropzone';
import { cn } from '../../../lib/utils';

const TabManual: React.FC = () => {
  const { manualConfig, loading, saveManualConfig, uploadManualPdf } = useManualConfig();
  const { notify } = useNotifications();
  const [gemsUrl, setGemsUrl] = useState(manualConfig.gemsUrl || '');
  const [uploading, setUploading] = useState(false);
  const [savingGems, setSavingGems] = useState(false);

  // Sincronizar cuando carga la config
  React.useEffect(() => {
    setGemsUrl(manualConfig.gemsUrl || '');
  }, [manualConfig.gemsUrl]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      notify('Solo se permiten archivos PDF', 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      notify('El archivo no puede superar 50MB', 'error');
      return;
    }

    setUploading(true);
    try {
      await uploadManualPdf(file);
      notify('Manual subido correctamente', 'success');
    } catch (err: any) {
      notify(err.message || 'Error al subir el manual', 'error');
    } finally {
      setUploading(false);
    }
  }, [uploadManualPdf, notify]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleSaveGemsUrl = async () => {
    setSavingGems(true);
    try {
      await saveManualConfig({ gemsUrl: gemsUrl.trim() });
      notify('Link de Gems guardado', 'success');
    } catch {
      notify('Error al guardar', 'error');
    } finally {
      setSavingGems(false);
    }
  };

  const handleRemovePdf = async () => {
    try {
      await saveManualConfig({ pdfS3Key: '', pdfFileName: '' });
      notify('Manual eliminado', 'info');
    } catch {
      notify('Error al eliminar', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
        Cargando configuración del manual...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Subida de PDF */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} />
            Manual de Uso (PDF)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Sube el manual en formato PDF. Este archivo estará disponible para todos los usuarios en la sección "Manual" del menú lateral.
          </p>

          {/* Estado actual del PDF */}
          {manualConfig.pdfS3Key && (
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle size={18} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {manualConfig.pdfFileName || 'Manual cargado'}
                  </p>
                  {manualConfig.updatedAt && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Actualizado: {new Date(manualConfig.updatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleRemovePdf}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                title="Eliminar manual"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              isDragActive
                ? 'border-brand bg-brand-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-brand hover:bg-slate-50 dark:hover:bg-slate-800',
              uploading && 'opacity-60 pointer-events-none'
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              {uploading ? (
                <>
                  <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Subiendo manual...</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Upload size={24} className="text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {manualConfig.pdfS3Key ? 'Reemplazar manual' : 'Arrastra tu PDF aquí'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar • Máximo 50MB</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link de Google Gems */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles size={16} />
            Asistente IA — Google Gems
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Configura el enlace a la Gem de Google que actúa como asistente del comité. Los usuarios verán un botón para acceder directamente.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">URL de la Gem</label>
            <div className="flex gap-2">
              <Input
                value={gemsUrl}
                onChange={e => setGemsUrl(e.target.value)}
                placeholder="https://gemini.google.com/app/..."
                className="flex-1"
              />
              <Button
                onClick={handleSaveGemsUrl}
                disabled={savingGems || gemsUrl === manualConfig.gemsUrl}
                className="gap-2 shrink-0"
              >
                <Save size={14} />
                {savingGems ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
            {manualConfig.gemsUrl && (
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400">Link configurado</span>
                <a href={manualConfig.gemsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline ml-auto">
                  Probar enlace →
                </a>
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Nota:</strong> Los usuarios necesitan acceso a Google Gems con su cuenta de Google para usar el asistente IA.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TabManual;
