/**
 * Exportación del PDF firmado del flujo de aprobación de artes.
 *
 * Toma la versión vigente del arte en S3 y le agrega una hoja final con las
 * firmas digitales de los equipos que aprobaron. La construcción de esa hoja
 * vive en artes-signature-sheet.ts (sin dependencias de la app).
 */
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { getArteDownloadUrl } from './artes-api';
import { appendSignatureSheet, nombreArchivoFirmado } from './artes-signature-sheet';
import type { SignatureSheetData } from './artes-signature-sheet';

export type { SignatureSheetData };
export { appendSignatureSheet };

/**
 * Descarga el arte vigente de S3, le agrega la hoja de firmas y lo guarda.
 *
 * @param data flujo, historial de decisiones y equipos en orden
 * @param fileName nombre del archivo de salida (opcional)
 */
export async function exportArteFirmado(data: SignatureSheetData, fileName?: string): Promise<void> {
  const { flow } = data;
  if (!flow.s3Key) throw new Error('El arte no tiene un archivo asociado en S3.');

  // Siempre se pide una URL presignada fresca para evitar expiraciones
  const url = await getArteDownloadUrl(flow.s3Key);
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`No se pudo descargar el arte (${res.status})`);
  const bytes = await res.arrayBuffer();

  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  await appendSignatureSheet(pdfDoc, data);

  const salida = await pdfDoc.save();
  saveAs(
    new Blob([new Uint8Array(salida)], { type: 'application/pdf' }),
    fileName || nombreArchivoFirmado(flow),
  );
  // Da tiempo al navegador a procesar la descarga antes de liberar el spinner
  await new Promise(r => setTimeout(r, 1200));
}
