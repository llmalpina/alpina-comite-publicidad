/**
 * Hoja de firmas digitales del flujo de aprobación de artes.
 *
 * Módulo sin dependencias de la app (solo pdf-lib) para poder generarlo y
 * probarlo en aislamiento. La orquestación (descargar de S3 y guardar el
 * archivo) vive en artes-pdf.ts.
 */
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import type { ArteApproval, ArteFlow, ArteTeamRef } from '../types/artes';

const BRAND = rgb(0.118, 0.227, 0.373);   // #1e3a5f
const BRAND_LIGHT = rgb(0.576, 0.773, 0.988);
const GREEN = rgb(0.082, 0.502, 0.239);
const RED = rgb(0.863, 0.149, 0.149);
const GRAY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.89, 0.91, 0.94);
const TEXT = rgb(0.11, 0.13, 0.15);

const PAGE_WIDTH = 612;   // Letter
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * pdf-lib solo escribe WinAnsi con las fuentes estándar: se quitan los
 * diacríticos y cualquier carácter no representable para evitar excepciones.
 */
export function sanitize(text: string): string {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

/** Corta el texto en líneas que quepan en el ancho indicado */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = sanitize(text);
  if (!clean) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of clean.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function fechaHora(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return String(iso); }
}

/**
 * Sello de verificación: identificador corto y estable derivado del flujo y de
 * las firmas. No es criptográfico; sirve para cotejar el PDF impreso contra el
 * registro de la plataforma.
 */
export function selloVerificacion(flow: ArteFlow, approvals: ArteApproval[]): string {
  const semilla = [
    flow.solicitudId, flow.cycle, flow.arteVersion,
    ...approvals.map(a => `${a.teamId}${a.at}`),
  ].join('|');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < semilla.length; i++) {
    h1 = ((h1 ^ semilla.charCodeAt(i)) * 0x01000193) >>> 0;
    h2 = ((h2 + semilla.charCodeAt(i) * (i + 7)) * 0x27220a95) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase().slice(0, 16);
  return hex.replace(/(.{4})(?=.)/g, '$1-');
}

/** Datos que necesita la hoja de firmas */
export interface SignatureSheetData {
  flow: ArteFlow;
  approvals: ArteApproval[];
  teams: ArteTeamRef[];
}

/**
 * Agrega al final del documento una hoja con las firmas de los equipos:
 * equipo, quién firmó, correo, fecha y hora exacta, notas, historial de todas
 * las rondas y el sello de verificación.
 */
export async function appendSignatureSheet(pdfDoc: PDFDocument, data: SignatureSheetData): Promise<void> {
  const { flow, approvals, teams } = data;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT;

  const nuevaPagina = () => { page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]); y = PAGE_HEIGHT - MARGIN; };
  const espacio = (alto: number) => { if (y - alto < MARGIN + 40) nuevaPagina(); };
  const titulo = (texto: string) => {
    espacio(40);
    page.drawText(sanitize(texto), { x: MARGIN, y, size: 9, font: bold, color: GRAY });
    y -= 8;
    page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 1.2, color: LINE });
    y -= 20;
  };

  const aprobado = flow.estado === 'APROBADO';

  // ── Encabezado ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 120, width: PAGE_WIDTH, height: 120, color: BRAND });
  page.drawText(sanitize(aprobado ? 'ARTE APROBADO - FIRMAS DIGITALES' : 'FLUJO DE FIRMAS - EN CURSO'), {
    x: MARGIN, y: PAGE_HEIGHT - 52, size: 18, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText(sanitize('Comite de Publicidad Alpina - Aprobacion de artes por equipos'), {
    x: MARGIN, y: PAGE_HEIGHT - 74, size: 10, font, color: BRAND_LIGHT,
  });
  page.drawText(sanitize(`Documento generado el ${fechaHora(new Date().toISOString())}`), {
    x: MARGIN, y: PAGE_HEIGHT - 94, size: 8.5, font, color: rgb(0.7, 0.8, 0.9),
  });
  y = PAGE_HEIGHT - 150;

  // ── Datos de la pieza ───────────────────────────────────────────────────────
  titulo('DATOS DE LA PIEZA');
  const filas: [string, string][] = [
    ['Consecutivo', flow.consecutive || '-'],
    ['Pieza', flow.title || '-'],
    ['Marca', flow.brand || '-'],
    ['Solicitante', `${flow.solicitanteName || '-'}${flow.area ? ` (${flow.area})` : ''}`],
    ['Version del arte', `v${flow.arteVersion}`],
    ['Ronda de firmas', String(flow.cycle)],
    ['Estado', aprobado ? 'Aprobado por todos los equipos' : 'En curso'],
  ];
  filas.forEach(([label, valor]) => {
    espacio(18);
    page.drawText(sanitize(label), { x: MARGIN, y, size: 9, font: bold, color: GRAY });
    wrapText(valor, font, 10, CONTENT_WIDTH - 130).slice(0, 2).forEach((linea, i) => {
      page.drawText(linea, { x: MARGIN + 130, y: y - i * 12, size: 10, font, color: TEXT });
    });
    y -= 18;
  });
  y -= 12;

  // ── Firmas del ciclo vigente ────────────────────────────────────────────────
  titulo('FIRMAS DE LOS EQUIPOS');
  const secuencia = teams.length
    ? teams
    : (flow.teamOrder || []).map(id => ({ id, label: id } as ArteTeamRef));

  secuencia.forEach((team, idx) => {
    const firma = (flow.approvals || {})[team.id];
    const firmado = !!firma && firma.decision === 'APROBADO';
    const alto = firma && firma.comment ? 78 : 62;
    espacio(alto + 10);

    page.drawRectangle({
      x: MARGIN, y: y - alto + 14, width: CONTENT_WIDTH, height: alto,
      borderColor: firmado ? rgb(0.72, 0.94, 0.79) : LINE, borderWidth: 1,
      color: firmado ? rgb(0.965, 0.992, 0.972) : rgb(0.98, 0.985, 0.99),
    });
    page.drawRectangle({
      x: MARGIN, y: y - alto + 14, width: 4, height: alto,
      color: firmado ? GREEN : rgb(0.8, 0.83, 0.87),
    });
    page.drawText(sanitize(`${idx + 1}. ${team.label}`), {
      x: MARGIN + 16, y, size: 11, font: bold, color: TEXT,
    });
    page.drawText(sanitize(firmado ? 'APROBADO' : 'PENDIENTE'), {
      x: PAGE_WIDTH - MARGIN - 80, y, size: 9, font: bold, color: firmado ? GREEN : GRAY,
    });

    if (firma) {
      page.drawText(sanitize(`Firmo: ${firma.by || '-'}`), { x: MARGIN + 16, y: y - 15, size: 9.5, font, color: rgb(0.2, 0.22, 0.25) });
      page.drawText(sanitize(firma.email || ''), { x: MARGIN + 16, y: y - 28, size: 8.5, font, color: GRAY });
      page.drawText(sanitize(`Fecha y hora: ${fechaHora(firma.at)}`), { x: MARGIN + 260, y: y - 15, size: 8.5, font, color: GRAY });
      if (firma.comment) {
        wrapText(`Nota: ${firma.comment}`, font, 8.5, CONTENT_WIDTH - 40).slice(0, 2).forEach((linea, i) => {
          page.drawText(linea, { x: MARGIN + 16, y: y - 42 - i * 11, size: 8.5, font, color: GRAY });
        });
      }
    } else {
      page.drawText(sanitize('Sin firma registrada'), { x: MARGIN + 16, y: y - 15, size: 9, font, color: GRAY });
    }
    y -= alto + 10;
  });

  // ── Historial completo (todas las rondas) ───────────────────────────────────
  if (approvals.length > 0) {
    y -= 6;
    titulo('HISTORIAL DE DECISIONES');
    [...approvals].sort((a, b) => String(a.at).localeCompare(String(b.at))).forEach(a => {
      espacio(26);
      const ok = a.decision === 'APROBADO';
      page.drawCircle({ x: MARGIN + 4, y: y + 3, size: 3, color: ok ? GREEN : RED });
      page.drawText(sanitize(`Ronda ${a.cycle} - v${a.arteVersion} - ${a.teamLabel || a.teamId}`), {
        x: MARGIN + 14, y, size: 9, font: bold, color: rgb(0.2, 0.22, 0.25),
      });
      page.drawText(sanitize(ok ? 'Aprobo' : 'Devolvio'), {
        x: MARGIN + 250, y, size: 9, font: bold, color: ok ? GREEN : RED,
      });
      page.drawText(sanitize(`${a.approverName || '-'} - ${fechaHora(a.at)}`), {
        x: MARGIN + 320, y, size: 8, font, color: GRAY,
      });
      y -= 13;
      if (a.comment) {
        wrapText(a.comment, font, 8, CONTENT_WIDTH - 30).slice(0, 3).forEach(linea => {
          espacio(12);
          page.drawText(linea, { x: MARGIN + 14, y, size: 8, font, color: GRAY });
          y -= 10;
        });
      }
      y -= 5;
    });
  }

  // ── Sello de verificación ───────────────────────────────────────────────────
  espacio(80);
  y -= 10;
  page.drawRectangle({
    x: MARGIN, y: y - 52, width: CONTENT_WIDTH, height: 62,
    color: rgb(0.96, 0.97, 0.99), borderColor: LINE, borderWidth: 1,
  });
  page.drawText(sanitize('SELLO DE VERIFICACION'), { x: MARGIN + 14, y: y - 8, size: 8, font: bold, color: GRAY });
  page.drawText(selloVerificacion(flow, approvals), { x: MARGIN + 14, y: y - 26, size: 13, font: bold, color: BRAND });
  page.drawText(sanitize(`ID de flujo: ${flow.solicitudId}`), { x: MARGIN + 14, y: y - 42, size: 7.5, font, color: GRAY });
  page.drawText(sanitize('Este codigo permite cotejar las firmas contra el registro de la plataforma.'), {
    x: MARGIN + 260, y: y - 42, size: 7.5, font, color: GRAY,
  });
}

/** Nombre sugerido para el archivo firmado */
export function nombreArchivoFirmado(flow: ArteFlow): string {
  return `${flow.consecutive || 'arte'}_v${flow.arteVersion}_firmado.pdf`.replace(/\s+/g, '_');
}
