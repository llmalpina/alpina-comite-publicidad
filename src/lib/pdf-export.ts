/**
 * Exportar PDF con anotaciones incrustadas como PDF annotations nativas.
 * Usa pdf-lib para modificar el PDF original y agregar sticky notes / highlights.
 */
import { PDFDocument, PDFPage, PDFName, PDFArray, PDFString } from 'pdf-lib';

export interface ExportAnnotation {
  id: string;
  page: number;       // 1-indexed
  x: number;          // % from left
  y: number;          // % from top
  x2?: number;
  y2?: number;
  text: string;
  userName: string;
  area?: string;
  tool?: string;
  color?: string;
  resolved?: boolean;
}

/**
 * Descarga el PDF desde una URL, incrusta las anotaciones como sticky notes
 * y retorna el PDF modificado como Blob para descarga.
 */
export async function exportPdfWithAnnotations(
  pdfUrl: string,
  annotations: ExportAnnotation[],
  fileName?: string
): Promise<void> {
  // 1. Descargar el PDF original
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error('No se pudo descargar el PDF');
  const pdfBytes = await response.arrayBuffer();

  // 2. Cargar con pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  // 3. Agregar anotaciones por página
  const activeAnnotations = annotations.filter(a => !a.resolved);

  for (const ann of activeAnnotations) {
    const pageIndex = ann.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Convertir coordenadas de % a puntos PDF
    // En PDF, Y=0 es abajo; en nuestra app, Y=0 es arriba
    const pdfX = (ann.x / 100) * width;
    const pdfY = height - (ann.y / 100) * height;

    const tool = ann.tool || 'pin';
    const commentText = `[${ann.userName}${ann.area ? ' - ' + ann.area : ''}]: ${ann.text}`;

    if (tool === 'pin' || tool === 'select') {
      addTextAnnotation(page, pdfDoc, pdfX, pdfY, commentText, ann.color);
    } else if (tool === 'rect' && ann.x2 !== undefined && ann.y2 !== undefined) {
      const pdfX2 = (ann.x2 / 100) * width;
      const pdfY2 = height - (ann.y2 / 100) * height;
      addSquareAnnotation(page, pdfDoc, pdfX, pdfY, pdfX2, pdfY2, commentText, ann.color);
    } else if ((tool === 'underline' || tool === 'strikethrough' || tool === 'arrow') && ann.x2 !== undefined && ann.y2 !== undefined) {
      const midX = ((ann.x + ann.x2) / 2 / 100) * width;
      const midY = height - ((ann.y + ann.y2) / 2 / 100) * height;
      addTextAnnotation(page, pdfDoc, midX, midY, commentText, ann.color);
    } else if (tool === 'freehand') {
      addTextAnnotation(page, pdfDoc, pdfX, pdfY, commentText, ann.color);
    } else {
      addTextAnnotation(page, pdfDoc, pdfX, pdfY, commentText, ann.color);
    }
  }

  // 4. Serializar y descargar
  const modifiedPdfBytes = await pdfDoc.save();
  const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'documento_con_comentarios.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Obtiene o crea el array de anotaciones de una página.
 * Evita el error "Expected instance of PDFArray" cuando la página no tiene Annots.
 */
function getOrCreateAnnotsArray(page: PDFPage, doc: PDFDocument): PDFArray {
  const existingAnnots = page.node.get(PDFName.of('Annots'));

  if (existingAnnots instanceof PDFArray) {
    return existingAnnots;
  }

  // Si es una referencia, resolver
  if (existingAnnots) {
    const resolved = doc.context.lookup(existingAnnots);
    if (resolved instanceof PDFArray) {
      return resolved;
    }
  }

  // No existe — crear un nuevo array vacío y asignarlo a la página
  const newAnnots = doc.context.obj([]);
  page.node.set(PDFName.of('Annots'), newAnnots);
  return newAnnots;
}

/**
 * Agrega una Text Annotation (sticky note) nativa al PDF.
 */
function addTextAnnotation(
  page: PDFPage,
  doc: PDFDocument,
  x: number,
  y: number,
  contents: string,
  color?: string
) {
  const { r, g, b } = parseColor(color || '#ef4444');

  const annotDict = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [x - 12, y - 12, x + 12, y + 12],
    Contents: PDFString.of(contents),
    C: [r, g, b],
    Name: 'Comment',
    Open: false,
    F: 4,
  });

  const ref = doc.context.register(annotDict);
  const annots = getOrCreateAnnotsArray(page, doc);
  annots.push(ref);
}

/**
 * Agrega una Square Annotation (rectángulo con comentario) al PDF.
 */
function addSquareAnnotation(
  page: PDFPage,
  doc: PDFDocument,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  contents: string,
  color?: string
) {
  const { r, g, b } = parseColor(color || '#ef4444');

  const lx = Math.min(x1, x2);
  const ly = Math.min(y1, y2);
  const ux = Math.max(x1, x2);
  const uy = Math.max(y1, y2);

  const annotDict = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Square',
    Rect: [lx, ly, ux, uy],
    Contents: PDFString.of(contents),
    C: [r, g, b],
    IC: [r, g, b],
    BS: doc.context.obj({ W: 2, S: 'S' }),
    CA: 0.3,
    F: 4,
  });

  const ref = doc.context.register(annotDict);
  const annots = getOrCreateAnnotsArray(page, doc);
  annots.push(ref);
}

/**
 * Parsea un color hex a valores RGB normalizados (0-1).
 */
function parseColor(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}
