/**
 * Exportación de solicitudes (piezas del comité) a Excel.
 *
 * No incluye nada del flujo de aprobación de artes por equipos: es exclusivamente
 * el reporte de piezas/solicitudes del comité, filtrable por rango de fechas.
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { STATUS_LABELS } from './constants';
import type { Solicitud } from '../types';

const BRAND_COLOR = 'FF1E3A5F';

/** Etiqueta legible del estado; si no está en el mapa, se muestra tal cual */
function statusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, { label: string }>)[status]?.label || status;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Etiqueta del tipo de contenido, resolviendo con el mapa de Maestros si está disponible */
function contentTypeLabel(value: string | undefined, labelMap?: Map<string, string>): string {
  if (!value) return '';
  return labelMap?.get(value) || value.replace(/_/g, ' ');
}

export interface ExportFilters {
  /** Fecha inicial (incluida), formato ISO o Date */
  from?: string | Date | null;
  /** Fecha final (incluida), formato ISO o Date */
  to?: string | Date | null;
  /** Filtra por marca exacta */
  brand?: string;
  /** Filtra por estado exacto */
  status?: string;
}

/** Aplica los filtros de fecha/marca/estado sobre la fecha de creación */
export function filterSolicitudesForExport(solicitudes: Solicitud[], filters: ExportFilters): Solicitud[] {
  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;
  // Incluye todo el día "to" (hasta las 23:59:59.999)
  if (to) to.setHours(23, 59, 59, 999);

  return solicitudes.filter(s => {
    const created = new Date(s.createdAt);
    if (from && created < from) return false;
    if (to && created > to) return false;
    if (filters.brand && s.brand !== filters.brand) return false;
    if (filters.status && s.status !== filters.status) return false;
    return true;
  });
}

/**
 * Genera y descarga un archivo .xlsx con el detalle de las solicitudes dadas.
 * Una fila por solicitud, con las columnas relevantes para reporteo del comité.
 */
export async function exportSolicitudesToExcel(
  solicitudes: Solicitud[],
  options: { fileName?: string; contentTypeLabels?: Map<string, string> } = {},
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Comité de Publicidad Alpina';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Solicitudes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const columns: { header: string; key: string; width: number }[] = [
    { header: 'Consecutivo', key: 'consecutive', width: 14 },
    { header: 'Título', key: 'title', width: 32 },
    { header: 'Marca', key: 'brand', width: 18 },
    { header: 'Producto', key: 'product', width: 20 },
    { header: 'Tipo de contenido', key: 'contentType', width: 28 },
    { header: 'Canal', key: 'channel', width: 16 },
    { header: 'Estado', key: 'status', width: 20 },
    { header: 'Prioridad', key: 'priority', width: 12 },
    { header: 'N° piezas', key: 'numeroPiezas', width: 10 },
    { header: 'Solicitante', key: 'solicitanteName', width: 24 },
    { header: 'Correo solicitante', key: 'solicitanteEmail', width: 28 },
    { header: 'Área', key: 'area', width: 22 },
    { header: 'Fecha creación', key: 'createdAt', width: 16 },
    { header: 'Fecha límite', key: 'deadline', width: 16 },
    { header: 'Fecha deseada revisión', key: 'fechaDeseadaRevision', width: 18 },
    { header: 'Última actualización', key: 'updatedAt', width: 18 },
    { header: 'Versión actual', key: 'currentVersion', width: 12 },
    { header: 'Aprobó ARA', key: 'araAprobado', width: 12 },
    { header: 'ARA - por', key: 'araBy', width: 20 },
    { header: 'ARA - fecha', key: 'araAt', width: 18 },
    { header: 'Aprobó Legal', key: 'legalAprobado', width: 12 },
    { header: 'Legal - por', key: 'legalBy', width: 20 },
    { header: 'Legal - fecha', key: 'legalAt', width: 18 },
    { header: 'Motivo rechazo', key: 'rejectionReason', width: 30 },
    { header: '# Comentarios', key: 'numComentarios', width: 12 },
    { header: '# Anotaciones', key: 'numAnotaciones', width: 12 },
  ];
  sheet.columns = columns;

  // Encabezado con estilo
  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  headerRow.height = 22;

  solicitudes.forEach(s => {
    sheet.addRow({
      consecutive: s.consecutive || '',
      title: s.title || '',
      brand: s.brand || '',
      product: s.product || '',
      contentType: contentTypeLabel(s.contentType, options.contentTypeLabels),
      channel: s.channel || '',
      status: statusLabel(s.status),
      priority: s.priority ? { red: 'Urgente', yellow: 'Media', green: 'Normal' }[s.priority] || s.priority : '',
      numeroPiezas: s.numeroPiezas || 1,
      solicitanteName: s.solicitanteName || '',
      solicitanteEmail: s.solicitanteEmail || '',
      area: s.area || '',
      createdAt: fmtDate(s.createdAt),
      deadline: fmtDate(s.deadline),
      fechaDeseadaRevision: fmtDate(s.fechaDeseadaRevision),
      updatedAt: fmtDateTime(s.updatedAt),
      currentVersion: s.currentVersion || 1,
      araAprobado: s.approvalARA ? (s.approvalARA.approved ? 'Sí' : 'No') : '',
      araBy: s.approvalARA?.by || '',
      araAt: fmtDateTime(s.approvalARA?.at),
      legalAprobado: s.approvalLegal ? (s.approvalLegal.approved ? 'Sí' : 'No') : '',
      legalBy: s.approvalLegal?.by || '',
      legalAt: fmtDateTime(s.approvalLegal?.at),
      rejectionReason: s.rejectionReason || '',
      numComentarios: Array.isArray(s.comments) ? s.comments.length : 0,
      numAnotaciones: Array.isArray(s.annotations) ? s.annotations.length : 0,
    });
  });

  // Bordes suaves y zebra striping para legibilidad
  sheet.eachRow((row, rowNumber) => {
    row.eachCell(cell => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (rowNumber > 1) cell.alignment = { vertical: 'middle' };
    });
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
    }
  });

  // Hoja de resumen
  const resumen = workbook.addWorksheet('Resumen');
  resumen.columns = [{ header: 'Indicador', key: 'k', width: 32 }, { header: 'Valor', key: 'v', width: 20 }];
  const headerResumen = resumen.getRow(1);
  headerResumen.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } };
  });
  const total = solicitudes.length;
  const porEstado: Record<string, number> = {};
  solicitudes.forEach(s => { porEstado[s.status] = (porEstado[s.status] || 0) + 1; });
  resumen.addRow({ k: 'Total de solicitudes exportadas', v: total });
  resumen.addRow({ k: 'Generado el', v: fmtDateTime(new Date().toISOString()) });
  resumen.addRow({ k: '', v: '' });
  resumen.addRow({ k: 'Por estado', v: '' }).font = { bold: true };
  Object.entries(porEstado).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    resumen.addRow({ k: statusLabel(status), v: count });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = options.fileName || `solicitudes_comite_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}
