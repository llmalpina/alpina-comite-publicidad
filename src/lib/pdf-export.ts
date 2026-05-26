/**
 * Exportar PDF con anotaciones.
 * Estrategia: Obtiene URL presignada fresca, descarga el PDF, agrega anotaciones nativas
 * y páginas de resumen con todos los comentarios organizados por página.
 */
import { PDFDocument, PDFPage, PDFName, PDFArray, PDFString, PDFRef, rgb, StandardFonts } from 'pdf-lib';

export interface ExportAnnotation {
  id: string;
  page: number;
  x: number;
  y: number;
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
 * Genera un PDF completo: PDF original con anotaciones nativas + páginas de resumen al final.
 * Siempre obtiene una URL presignada fresca para evitar expiración.
 * 
 * @param s3Key - La key del archivo en S3 (no la URL presignada)
 * @param annotations - Las anotaciones a incluir
 * @param fileName - Nombre del archivo de salida
 */
export async function exportPdfWithAnnotations(
  pdfUrlOrKey: string,
  annotations: ExportAnnotation[],
  fileName?: string
): Promise<void> {
  const activeAnnotations = annotations.filter(a => !a.resolved);
  if (activeAnnotations.length === 0) {
    throw new Error('No hay comentarios activos para exportar.');
  }

  // 1. Obtener URL presignada FRESCA (no usar la que ya tenemos que puede estar expirada)
  const pdfBytes = await downloadPdfFresh(pdfUrlOrKey);

  // 2. Cargar con pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // 3. Agregar anotaciones nativas al PDF (sticky notes visibles en Adobe Reader)
  try {
    addNativeAnnotations(pdfDoc, activeAnnotations);
  } catch (e) {
    console.warn('[pdf-export] Error agregando anotaciones nativas:', e);
  }

  // 4. Agregar páginas de resumen al final
  await addSummaryPages(pdfDoc, activeAnnotations, true);

  // 5. Serializar y descargar
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
 * Descarga el PDF obteniendo SIEMPRE una URL presignada fresca del backend.
 * Esto evita el problema de URLs expiradas.
 */
async function downloadPdfFresh(pdfUrlOrKey: string): Promise<ArrayBuffer> {
  const PRESIGN_URL = (import.meta as any).env?.VITE_PRESIGN_URL as string;
  
  // Extraer la s3Key de la URL (si es una URL) o usarla directamente (si ya es una key)
  let s3Key: string;
  if (pdfUrlOrKey.startsWith('http')) {
    s3Key = extractS3KeyFromUrl(pdfUrlOrKey) || '';
  } else {
    s3Key = pdfUrlOrKey;
  }

  if (!s3Key) {
    throw new Error('No se pudo determinar la ubicación del PDF en S3.');
  }

  if (!PRESIGN_URL) {
    throw new Error('PRESIGN_URL no configurada. No se puede descargar el PDF.');
  }

  // Obtener URL presignada fresca (válida por 1 hora)
  const presignRes = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'download', key: s3Key }),
  });

  if (!presignRes.ok) {
    throw new Error(`Error al obtener URL de descarga (${presignRes.status})`);
  }

  const presignData = await presignRes.json();
  if (!presignData.url) {
    throw new Error('El servidor no devolvió una URL de descarga válida.');
  }

  // Descargar el PDF con la URL fresca
  const pdfRes = await fetch(presignData.url);
  if (!pdfRes.ok) {
    throw new Error(`Error al descargar el PDF (${pdfRes.status}). Intenta de nuevo.`);
  }

  return await pdfRes.arrayBuffer();
}

/**
 * Agrega páginas de resumen de comentarios al final del PDF.
 * Diseño llamativo con colores, iconos y organización por página.
 */
async function addSummaryPages(
  pdfDoc: PDFDocument,
  annotations: ExportAnnotation[],
  hasOriginal: boolean
): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 612; // Letter
  const PAGE_HEIGHT = 792;
  const MARGIN = 50;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  // Agrupar por página
  const byPage = new Map<number, ExportAnnotation[]>();
  for (const ann of annotations) {
    const list = byPage.get(ann.page) || [];
    list.push(ann);
    byPage.set(ann.page, list);
  }
  const sortedPages = [...byPage.keys()].sort((a, b) => a - b);

  let currentPage: PDFPage | null = null;
  let yPos = 0;

  const ensurePage = () => {
    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    yPos = PAGE_HEIGHT - MARGIN;
    return currentPage;
  };

  const checkSpace = (needed: number) => {
    if (yPos - needed < MARGIN + 30) {
      ensurePage();
    }
  };

  // --- Página de título ---
  ensurePage();

  // Header con fondo azul oscuro
  currentPage!.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 120, width: PAGE_WIDTH, height: 120,
    color: rgb(0.118, 0.227, 0.373), // #1e3a5f
  });

  currentPage!.drawText('RESUMEN DE COMENTARIOS', {
    x: MARGIN, y: PAGE_HEIGHT - 55,
    size: 22, font: fontBold, color: rgb(1, 1, 1),
  });

  currentPage!.drawText('Comité de Publicidad Alpina', {
    x: MARGIN, y: PAGE_HEIGHT - 80,
    size: 11, font, color: rgb(0.576, 0.773, 0.988), // #93c5fd
  });

  const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  currentPage!.drawText(`Generado: ${dateStr}`, {
    x: MARGIN, y: PAGE_HEIGHT - 100,
    size: 9, font, color: rgb(0.7, 0.8, 0.9),
  });

  yPos = PAGE_HEIGHT - 150;

  // Resumen general
  currentPage!.drawText(`Total de comentarios: ${annotations.length}`, {
    x: MARGIN, y: yPos, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1),
  });
  yPos -= 20;

  currentPage!.drawText(`Páginas con comentarios: ${sortedPages.length}`, {
    x: MARGIN, y: yPos, size: 11, font, color: rgb(0.3, 0.3, 0.3),
  });
  yPos -= 15;

  if (!hasOriginal) {
    currentPage!.drawText('⚠ No se pudo adjuntar el PDF original (URL expirada). Solo se incluye el resumen.', {
      x: MARGIN, y: yPos, size: 9, font, color: rgb(0.8, 0.3, 0.0),
    });
    yPos -= 15;
  }

  yPos -= 25;

  // Línea separadora
  currentPage!.drawRectangle({
    x: MARGIN, y: yPos, width: CONTENT_WIDTH, height: 2,
    color: rgb(0.9, 0.9, 0.9),
  });
  yPos -= 30;

  // --- Comentarios por página ---
  for (const pageNum of sortedPages) {
    const pageAnns = byPage.get(pageNum)!;

    checkSpace(60);

    // Header de página con fondo
    currentPage!.drawRectangle({
      x: MARGIN - 5, y: yPos - 5, width: CONTENT_WIDTH + 10, height: 28,
      color: rgb(0.118, 0.227, 0.373),
      borderColor: rgb(0.118, 0.227, 0.373),
      borderWidth: 1,
    });

    currentPage!.drawText(`PÁGINA ${pageNum}`, {
      x: MARGIN + 8, y: yPos + 5,
      size: 12, font: fontBold, color: rgb(1, 1, 1),
    });

    currentPage!.drawText(`${pageAnns.length} comentario${pageAnns.length > 1 ? 's' : ''}`, {
      x: MARGIN + 120, y: yPos + 5,
      size: 10, font, color: rgb(0.75, 0.85, 1),
    });

    yPos -= 40;

    // Cada comentario
    for (let i = 0; i < pageAnns.length; i++) {
      const ann = pageAnns[i];
      const { r, g, b: blue } = parseColorNorm(ann.color || '#ef4444');

      // Calcular altura necesaria
      const textLines = wrapText(ann.text, font, 10, CONTENT_WIDTH - 80);
      const blockHeight = 45 + textLines.length * 14;
      checkSpace(blockHeight + 10);

      // Barra lateral de color
      currentPage!.drawRectangle({
        x: MARGIN, y: yPos - blockHeight + 20, width: 4, height: blockHeight - 5,
        color: rgb(r, g, blue),
      });

      // Círculo con número
      currentPage!.drawCircle({
        x: MARGIN + 20, y: yPos + 5, size: 10,
        color: rgb(r, g, blue),
      });
      currentPage!.drawText(`${i + 1}`, {
        x: MARGIN + 16, y: yPos + 1,
        size: 9, font: fontBold, color: rgb(1, 1, 1),
      });

      // Nombre y área
      currentPage!.drawText(ann.userName, {
        x: MARGIN + 38, y: yPos + 5,
        size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1),
      });

      if (ann.area) {
        const nameWidth = fontBold.widthOfTextAtSize(ann.userName, 10);
        currentPage!.drawText(`  •  ${ann.area}`, {
          x: MARGIN + 38 + nameWidth, y: yPos + 5,
          size: 9, font, color: rgb(0.4, 0.4, 0.4),
        });
      }

      // Posición en la página
      currentPage!.drawText(`Pos: ${Math.round(ann.x)}%, ${Math.round(ann.y)}%`, {
        x: MARGIN + 38, y: yPos - 10,
        size: 8, font, color: rgb(0.5, 0.5, 0.5),
      });

      // Texto del comentario
      let textY = yPos - 28;
      for (const line of textLines) {
        currentPage!.drawText(line, {
          x: MARGIN + 38, y: textY,
          size: 10, font, color: rgb(0.2, 0.2, 0.2),
        });
        textY -= 14;
      }

      yPos = textY - 15;

      // Separador entre comentarios
      if (i < pageAnns.length - 1) {
        currentPage!.drawRectangle({
          x: MARGIN + 38, y: yPos + 8, width: CONTENT_WIDTH - 50, height: 0.5,
          color: rgb(0.85, 0.85, 0.85),
        });
        yPos -= 5;
      }
    }

    yPos -= 20;
  }

  // Footer en la última página
  checkSpace(40);
  currentPage!.drawRectangle({
    x: MARGIN, y: yPos, width: CONTENT_WIDTH, height: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  yPos -= 20;
  currentPage!.drawText('Este documento fue generado automáticamente por el Comité de Publicidad Alpina.', {
    x: MARGIN, y: yPos, size: 8, font, color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Agrega anotaciones nativas al PDF (sticky notes visibles en lectores PDF).
 */
function addNativeAnnotations(pdfDoc: PDFDocument, annotations: ExportAnnotation[]): void {
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const pageIndex = ann.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();
    const pdfX = (ann.x / 100) * width;
    const pdfY = height - (ann.y / 100) * height;
    const commentText = `[${ann.userName}${ann.area ? ' - ' + ann.area : ''}]: ${ann.text}`;

    try {
      const safeContents = sanitizeText(commentText);
      const { r, g, b } = parseColorNorm(ann.color || '#ef4444');

      const annotDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Text',
        Rect: [pdfX - 14, pdfY - 14, pdfX + 14, pdfY + 14],
        Contents: PDFString.of(safeContents),
        C: [r, g, b],
        Name: 'Comment',
        Open: false,
        F: 4,
      });

      const ref = pdfDoc.context.register(annotDict);
      const annots = getOrCreateAnnotsArray(page, pdfDoc);
      annots.push(ref);
    } catch (e) {
      console.warn('[pdf-export] Error en anotación nativa:', e);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateAnnotsArray(page: PDFPage, doc: PDFDocument): PDFArray {
  const existingAnnots = page.node.get(PDFName.of('Annots'));
  if (existingAnnots instanceof PDFArray) return existingAnnots;
  if (existingAnnots instanceof PDFRef) {
    const resolved = doc.context.lookup(existingAnnots);
    if (resolved instanceof PDFArray) {
      page.node.set(PDFName.of('Annots'), resolved);
      return resolved;
    }
  }
  if (existingAnnots) {
    try {
      const resolved = doc.context.lookup(existingAnnots);
      if (resolved instanceof PDFArray) {
        page.node.set(PDFName.of('Annots'), resolved);
        return resolved;
      }
    } catch {}
  }
  const newAnnots = doc.context.obj([]);
  page.node.set(PDFName.of('Annots'), newAnnots);
  return newAnnots;
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function parseColorNorm(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

function extractS3KeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (path) return path;
    return null;
  } catch {
    return null;
  }
}
