import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, FileText, Maximize2, Pin, Square, ArrowRight, Pencil, Strikethrough, Underline as UnderlineIcon, MousePointer2, Hand } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';
import type { AnnotationTool } from '../../types';

pdfjs.GlobalWorkerOptions.workerSrc = imNICOLASport.meta.env.BASE_URL + 'pdf.worker.min.mjs';

export interface PdfAnnotationOverlay {
  id: string;
  page: number;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text: string;
  userName: string;
  area?: string;
  version?: number;
  resolved?: boolean;
  tool?: AnnotationTool;
  color?: string;
  points?: { x: number; y: number }[];
}

interface PdfViewerProps {
  url: string | null;
  fileName?: string;
  className?: string;
  annotating?: boolean;
  activeTool?: AnnotationTool;
  annotations?: PdfAnnotationOverlay[];
  pendingPin?: { x: number; y: number } | null;
  onAnnotationClick?: (page: number, x: number, y: number, x2?: number, y2?: number, tool?: AnnotationTool, color?: string, points?: {x:number;y:number}[]) => void;
  onPageChange?: (page: number) => void;
  goToPageRef?: React.MutableRefObject<((page: number) => void) | null>;
  /** Toolbar de herramientas de anotación */
  onToolChange?: (tool: AnnotationTool) => void;
  annotationColor?: string;
  onColorChange?: (color: string) => void;
  showToolbar?: boolean;
}

const TOOL_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const TOOLS: { key: AnnotationTool; icon: React.ElementType; label: string }[] = [
  { key: 'select', icon: MousePointer2, label: 'Seleccionar' },
  { key: 'hand', icon: Hand, label: 'Mover' },
  { key: 'pin', icon: Pin, label: 'Pin' },
  { key: 'rect', icon: Square, label: 'Rectangulo' },
  { key: 'underline', icon: UnderlineIcon, label: 'Subrayar' },
  { key: 'strikethrough', icon: Strikethrough, label: 'Tachar' },
  { key: 'arrow', icon: ArrowRight, label: 'Flecha' },
  { key: 'freehand', icon: Pencil, label: 'Dibujo libre' },
];

const PdfViewer: React.FC<PdfViewerProps> = ({
  url, fileName, className,
  annotating = false, activeTool = 'pin', annotations = [], pendingPin,
  onAnnotationClick, onPageChange, goToPageRef,
  onToolChange, annotationColor = '#ef4444', onColorChange, showToolbar = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fitToWidth, setFitToWidth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredAnn, setHoveredAnn] = useState<string | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<{ x: number; y: number }[]>([]);

  // Pan (hand tool) — uses refs for smooth performance, no re-renders
  const isPanningRef = useRef(false);
  const panLastRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDown = (e: MouseEvent) => {
      // Pan with hand tool OR middle mouse button
      if (activeTool === 'hand' || e.button === 1) {
        isPanningRef.current = true;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        el.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };
    const onMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      el.scrollLeft -= (e.clientX - panLastRef.current.x);
      el.scrollTop -= (e.clientY - panLastRef.current.y);
      panLastRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    };
    const onUp = () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      el.style.cursor = '';
    };

    // Zoom: Ctrl+wheel OR plain wheel when hand tool is active
    const onWheel = (e: WheelEvent) => {
      const shouldZoom = e.ctrlKey || e.metaKey || activeTool === 'hand';
      if (!shouldZoom) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const newScale = Math.min(4.0, Math.max(0.25, +(scaleRef.current + delta).toFixed(2)));
      setFitToWidth(false);
      setScale(newScale);
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [activeTool]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w - 48);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a');
      if (link?.href && !link.href.startsWith('javascript')) {
        e.preventDefault(); e.stopPropagation();
        window.open(link.href, '_blank', 'noopener');
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const changePage = (p: number) => { setCurrentPage(p); onPageChange?.(p); };
  useEffect(() => { if (goToPageRef) goToPageRef.current = changePage; }, [goToPageRef]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n); setLoading(false); setError(null);
  }, []);
  const onDocumentLoadError = useCallback((err: Error) => {
    setLoading(false); setError(err.message);
  }, []);

  // Get relative coords from mouse event
  const getRelCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const pageEl = pageRef.current?.querySelector('.react-pdf__Page');
    if (!pageEl) return null;
    const rect = pageEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'hand' || activeTool === 'select') return;
    if (!annotating || !onAnnotationClick) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const coords = getRelCoords(e);
    if (!coords) return;

    if (activeTool === 'pin') {
      onAnnotationClick(currentPage, coords.x, coords.y, undefined, undefined, 'pin', annotationColor);
      return;
    }
    setIsDrawing(true);
    setDrawStart(coords);
    setDrawEnd(coords);
    if (activeTool === 'freehand') setFreehandPoints([coords]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const coords = getRelCoords(e);
    if (!coords) return;
    setDrawEnd(coords);
    if (activeTool === 'freehand') setFreehandPoints(prev => [...prev, coords]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !drawEnd || !onAnnotationClick) { setIsDrawing(false); return; }
    const dx = Math.abs(drawEnd.x - drawStart.x);
    const dy = Math.abs(drawEnd.y - drawStart.y);
    if (dx < 1 && dy < 1 && activeTool !== 'freehand') { setIsDrawing(false); setDrawStart(null); setDrawEnd(null); return; }

    onAnnotationClick(
      currentPage, drawStart.x, drawStart.y, drawEnd.x, drawEnd.y,
      activeTool, annotationColor,
      activeTool === 'freehand' ? freehandPoints : undefined
    );
    setIsDrawing(false); setDrawStart(null); setDrawEnd(null); setFreehandPoints([]);
  };

  const pageAnnotations = annotations.filter(a => a.page === currentPage && !a.resolved);

  // Render annotation shape as SVG
  const renderAnnotationShape = (ann: PdfAnnotationOverlay, isPreview = false) => {
    const tool = ann.tool || 'pin';
    const color = ann.color || '#ef4444';
    const opacity = isPreview ? 0.5 : 0.6;
    const isHovered = hoveredAnn === ann.id;

    if (tool === 'pin') {
      return (
        <div key={ann.id}
          className="absolute z-20 group cursor-pointer"
          style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -100%)' }}
          onMouseEnter={() => setHoveredAnn(ann.id)}
          onMouseLeave={() => setHoveredAnn(null)}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg hover:scale-125 transition-transform"
            style={{ backgroundColor: color, border: `2px solid ${color}` }}>
            <Pin size={13} className="text-white" />
          </div>
          {(isHovered || isPreview) && !isPreview && (
            <div className="absolute left-10 top-0 w-56 bg-white dark:bg-slate-800 border shadow-xl rounded-lg p-3 z-30 pointer-events-none">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{ann.userName}</p>
              {ann.area && <p className="text-[10px] text-slate-500 mb-1">{ann.area} · Pag. {ann.page}</p>}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ann.text}</p>
            </div>
          )}
        </div>
      );
    }

    // SVG-based annotations
    const x1 = Math.min(ann.x, ann.x2 ?? ann.x);
    const y1 = Math.min(ann.y, ann.y2 ?? ann.y);
    const x2 = Math.max(ann.x, ann.x2 ?? ann.x);
    const y2 = Math.max(ann.y, ann.y2 ?? ann.y);
    const w = x2 - x1;
    const h = y2 - y1;

    return (
      <div key={ann.id} className="absolute inset-0 z-20 pointer-events-none" style={{ width: '100%', height: '100%' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} className="pointer-events-none">
          {tool === 'rect' && (
            <rect
              x={`${x1}%`} y={`${y1}%`} width={`${w}%`} height={`${h}%`}
              fill={color} fillOpacity={isHovered ? 0.3 : 0.15} stroke={color} strokeWidth="2" strokeOpacity={opacity}
              rx="4" className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredAnn(ann.id)} onMouseLeave={() => setHoveredAnn(null)}
            />
          )}
          {tool === 'underline' && (
            <line
              x1={`${ann.x}%`} y1={`${ann.y}%`} x2={`${ann.x2}%`} y2={`${ann.y2}%`}
              stroke={color} strokeWidth="3" strokeOpacity={opacity}
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredAnn(ann.id)} onMouseLeave={() => setHoveredAnn(null)}
            />
          )}
          {tool === 'strikethrough' && (
            <line
              x1={`${ann.x}%`} y1={`${ann.y}%`} x2={`${ann.x2}%`} y2={`${ann.y2}%`}
              stroke={color} strokeWidth="2" strokeOpacity={opacity} strokeDasharray="6,3"
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredAnn(ann.id)} onMouseLeave={() => setHoveredAnn(null)}
            />
          )}
          {tool === 'arrow' && (
            <g className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredAnn(ann.id)} onMouseLeave={() => setHoveredAnn(null)}>
              <defs><marker id={`arrow-${ann.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={color} />
              </marker></defs>
              <line x1={`${ann.x}%`} y1={`${ann.y}%`} x2={`${ann.x2}%`} y2={`${ann.y2}%`}
                stroke={color} strokeWidth="2" strokeOpacity={opacity} markerEnd={`url(#arrow-${ann.id})`} />
            </g>
          )}
          {tool === 'freehand' && ann.points && ann.points.length > 1 && (
            <polyline
              points={ann.points.map(p => `${p.x}% ${p.y}%`).join(' ')}
              fill="none" stroke={color} strokeWidth="2" strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round"
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredAnn(ann.id)} onMouseLeave={() => setHoveredAnn(null)}
            />
          )}
        </svg>
        {/* Tooltip */}
        {isHovered && ann.text && (
          <div className="absolute z-30 pointer-events-none"
            style={{ left: `${(x1 + x2) / 2}%`, top: `${y1}%`, transform: 'translate(-50%, -110%)' }}>
            <div className="bg-white dark:bg-slate-800 border shadow-xl rounded-lg p-3 w-56">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{ann.userName}</p>
              {ann.area && <p className="text-[10px] text-slate-500 mb-1">{ann.area} · Pag. {ann.page}</p>}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ann.text}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Drawing preview
  const renderDrawingPreview = () => {
    if (!isDrawing || !drawStart || !drawEnd) return null;
    const color = annotationColor;
    return (
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: 25, pointerEvents: 'none' }}>
        {activeTool === 'rect' && (
          <rect
            x={`${Math.min(drawStart.x, drawEnd.x)}%`} y={`${Math.min(drawStart.y, drawEnd.y)}%`}
            width={`${Math.abs(drawEnd.x - drawStart.x)}%`} height={`${Math.abs(drawEnd.y - drawStart.y)}%`}
            fill={color} fillOpacity={0.1} stroke={color} strokeWidth="2" strokeDasharray="6,3" rx="4"
          />
        )}
        {(activeTool === 'underline' || activeTool === 'strikethrough') && (
          <line x1={`${drawStart.x}%`} y1={`${drawStart.y}%`} x2={`${drawEnd.x}%`} y2={`${drawEnd.y}%`}
            stroke={color} strokeWidth={activeTool === 'underline' ? 3 : 2} strokeDasharray="6,3" />
        )}
        {activeTool === 'arrow' && (
          <line x1={`${drawStart.x}%`} y1={`${drawStart.y}%`} x2={`${drawEnd.x}%`} y2={`${drawEnd.y}%`}
            stroke={color} strokeWidth="2" strokeDasharray="6,3" />
        )}
        {activeTool === 'freehand' && freehandPoints.length > 1 && (
          <polyline points={freehandPoints.map(p => `${p.x}% ${p.y}%`).join(' ')}
            fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    );
  };

  if (!url) {
    return (
      <div className={cn('flex flex-col items-center justify-center min-h-[400px] bg-slate-100 dark:bg-slate-800 rounded-lg gap-3', className)}>
        <FileText size={48} className="text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-500">PDF no disponible</p>
        {fileName && <p className="text-xs text-slate-400">{fileName}</p>}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col bg-white dark:bg-slate-900', className)}>
      {/* Annotation Toolbar */}
      {showToolbar && annotating && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 flex-wrap">
          <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mr-1">Herramienta:</span>
          {TOOLS.map(t => (
            <button key={t.key} onClick={() => onToolChange?.(t.key)}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                activeTool === t.key
                  ? 'bg-[#1e3a5f] text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 hover:border-slate-400')}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
          <div className="w-px h-6 bg-yellow-300 mx-1" />
          <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mr-1">Color:</span>
          {TOOL_COLORS.map(c => (
            <button key={c} onClick={() => onColorChange?.(c)}
              className={cn('w-6 h-6 rounded-full border-2 transition-all',
                annotationColor === c ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent hover:scale-105')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      )}

      {/* Navigation Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => changePage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1 || loading}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs text-slate-600 dark:text-slate-400 min-w-[60px] text-center">
            {loading ? '...' : `${currentPage} / ${numPages}`}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => changePage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages || loading}>
            <ChevronRight size={14} />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant={fitToWidth ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setFitToWidth(v => !v)}>
            <Maximize2 size={13} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { setFitToWidth(false); setScale(s => Math.max(0.3, +(s - 0.15).toFixed(2))); }}>
            <ZoomOut size={14} />
          </Button>
          <span className="text-xs text-slate-600 dark:text-slate-400 w-10 text-center">
            {Math.round((fitToWidth && containerWidth > 0 ? containerWidth / 595 : scale) * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { setFitToWidth(false); setScale(s => Math.min(3.0, +(s + 0.15).toFixed(2))); }}>
            <ZoomIn size={14} />
          </Button>
        </div>
      </div>

      {/* Viewer */}
      <div ref={containerRef}
        className={cn('flex-1 overflow-scroll bg-slate-200 dark:bg-slate-700 min-h-[400px]',
          activeTool === 'hand' ? 'cursor-grab' :
          annotating && activeTool !== 'select' ? 'cursor-crosshair' : '')}
        onMouseUp={handleMouseUp}
      >
        {loading && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 w-full">
            <Loader2 size={32} className="animate-spin text-[#1e3a5f]" />
            <p className="text-sm text-slate-500">Cargando PDF...</p>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 w-full">
            <FileText size={48} className="text-slate-300" />
            <p className="text-sm text-slate-500">No se pudo cargar el PDF</p>
            <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>Abrir en nueva pestaña</Button>
          </div>
        )}

        {/* Wrapper que permite scroll libre — padding crea espacio para pan */}
        <div style={{ display: (loading || error) ? 'none' : 'flex', justifyContent: 'center', padding: '16px', minWidth: 'fit-content' }}>
          <div ref={pageRef} className={cn('relative', annotating && activeTool !== 'select' && activeTool !== 'hand' && 'select-none')}
          style={{ display: (loading || error) ? 'none' : 'block' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        >
          <Document file={url} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading="" className="shadow-2xl">
            <Page pageNumber={currentPage}
              scale={fitToWidth && containerWidth > 0 ? undefined : scale}
              width={fitToWidth && containerWidth > 0 ? containerWidth : undefined}
              renderTextLayer renderAnnotationLayer className="bg-white" />
          </Document>

          {/* Existing annotations */}
          {pageAnnotations.map(ann => renderAnnotationShape(ann))}

          {/* Drawing preview */}
          {renderDrawingPreview()}

          {/* Pending pin */}
          {pendingPin && activeTool === 'pin' && (
            <div className="absolute z-30 animate-pulse"
              style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%`, transform: 'translate(-50%, -100%)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: annotationColor, border: `2px solid ${annotationColor}` }}>
                <Pin size={13} className="text-white" />
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Thumbnails */}
      {numPages > 1 && !loading && !error && (
        <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-800 border-t overflow-x-auto shrink-0">
          {Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => changePage(p)}
              className={cn('shrink-0 w-10 h-14 border-2 rounded text-xs font-bold transition-all relative',
                p === currentPage ? 'border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-400')}>
              {p}
              {annotations.filter(a => a.page === p && !a.resolved).length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 border border-yellow-600 rounded-full text-[8px] font-bold text-yellow-900 flex items-center justify-center">
                  {annotations.filter(a => a.page === p && !a.resolved).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PdfViewer;
