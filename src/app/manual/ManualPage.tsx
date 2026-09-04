import React, { useState, useEffect } from 'react';
import { ExternalLink, FileText, Sparkles, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useManualConfig } from '../../hooks/useManualConfig';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = '/apprueba/pdf.worker.min.mjs';

const ManualPage: React.FC = () => {
  const { manualConfig, loading } = useManualConfig();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    if (manualConfig?.pdfS3Key) {
      setLoadingPdf(true);
      // Obtener URL presignada para el PDF del manual
      const fetchPdfUrl = async () => {
        try {
          const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
          const token = localStorage.getItem('alpina_id_token');
          const res = await fetch(PRESIGN_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ action: 'download', key: manualConfig.pdfS3Key }),
          });
          if (res.ok) {
            const data = await res.json();
            setPdfUrl(data.url);
          }
        } catch (err) {
          console.error('Error obteniendo URL del manual:', err);
        } finally {
          setLoadingPdf(false);
        }
      };
      fetchPdfUrl();
    }
  }, [manualConfig?.pdfS3Key]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Cargando manual...</p>
        </div>
      </div>
    );
  }

  const hasManual = manualConfig?.pdfS3Key;
  const hasGemsLink = manualConfig?.gemsUrl;

  if (!hasManual && !hasGemsLink) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FileText size={48} className="text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">Manual no disponible</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          El administrador aún no ha configurado el manual de uso. Contacta al equipo de soporte si necesitas ayuda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Manual de Uso</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Guía completa del Comité de Autorregulación Publicitaria
        </p>
      </div>

      {/* Link a Google Gems */}
      {hasGemsLink && (
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-none">
                  <Sparkles size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Asistente IA — Google Gems</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pregúntale a la IA cualquier duda sobre el proceso del comité
                  </p>
                </div>
              </div>
              <a
                href={manualConfig.gemsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200 dark:shadow-none">
                  <Sparkles size={16} />
                  Abrir Asistente
                  <ExternalLink size={14} />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visor de PDF */}
      {hasManual && (
        <Card>
          <CardContent className="p-0">
            {/* Barra de controles del PDF */}
            <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50 dark:bg-slate-800 rounded-t-xl">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {manualConfig.pdfFileName || 'Manual de uso'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Zoom */}
                <div className="flex items-center gap-1 border rounded-lg px-1 bg-white dark:bg-slate-700">
                  <button
                    onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                    className="p-1.5 text-slate-500 hover:text-slate-700 transition-colors"
                    title="Reducir"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 min-w-[3rem] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
                    className="p-1.5 text-slate-500 hover:text-slate-700 transition-colors"
                    title="Ampliar"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>

                {/* Paginación */}
                <div className="flex items-center gap-1 border rounded-lg px-1 bg-white dark:bg-slate-700">
                  <button
                    onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                    className="p-1.5 text-slate-500 hover:text-slate-700 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 min-w-[4rem] text-center">
                    {pageNumber} / {numPages}
                  </span>
                  <button
                    onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                    disabled={pageNumber >= numPages}
                    className="p-1.5 text-slate-500 hover:text-slate-700 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Descargar */}
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 h-8">
                      <Download size={14} />
                      Descargar
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Contenido del PDF */}
            <div className="flex justify-center overflow-auto bg-slate-100 dark:bg-slate-900 p-4 rounded-b-xl" style={{ minHeight: '70vh', maxHeight: '80vh' }}>
              {loadingPdf ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pdfUrl ? (
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center h-64">
                      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <FileText size={32} className="text-red-300 mb-3" />
                      <p className="text-sm text-red-500">Error al cargar el PDF</p>
                      <p className="text-xs text-slate-400 mt-1">Intenta recargar la página</p>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    className="shadow-xl rounded-lg overflow-hidden"
                  />
                </Document>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <FileText size={32} className="text-slate-300 mb-3" />
                  <p className="text-sm text-slate-400">No se pudo cargar el manual</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ManualPage;
