/**
 * Prueba de la hoja de firmas del PDF de artes.
 * Genera un PDF real y verifica su contenido.
 *
 * Ejecutar desde alpina-comité-de-publicidad:
 *   npx tsx scripts/test-artes-firmas.ts
 *
 * Deja el resultado en scripts/out/arte-firmado-prueba.pdf para revisarlo a ojo.
 */
import assert from 'node:assert';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  appendSignatureSheet, sanitize, wrapText, selloVerificacion, nombreArchivoFirmado,
} from '../src/lib/artes-signature-sheet';
import type { ArteApproval, ArteFlow, ArteTeamRef } from '../src/types/artes';

let ok = 0;
function test(nombre: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => { ok++; console.log(`  OK   ${nombre}`); })
    .catch((e: Error) => { console.error(`  FALLA ${nombre}\n        ${e.message}`); process.exitCode = 1; });
}

const teams: ArteTeamRef[] = [
  { id: 'EMPAQUES', label: 'Empaques', order: 1 },
  { id: 'MERCADEO', label: 'Mercadeo', order: 2 },
  { id: 'INOCUIDAD', label: 'Inocuidad', order: 3 },
  { id: 'DESARROLLO', label: 'Desarrollo', order: 4 },
];

const flowAprobado: ArteFlow = {
  solicitudId: 'a1b2c3d4-0000-1111-2222-333344445555',
  sk: 'flow', tipo: 'arte-flow', estado: 'APROBADO',
  teamOrder: teams.map(t => t.id),
  currentTeamId: null, currentTeamLabel: null,
  cycle: 2,
  approvals: {
    EMPAQUES:   { decision: 'APROBADO', by: 'Ana Gómez',      email: 'ana@alpina.com',   at: '2026-08-27T15:04:11.000Z', comment: 'Medidas de empaque validadas.', teamLabel: 'Empaques' },
    MERCADEO:   { decision: 'APROBADO', by: 'Beto Ríos',      email: 'beto@alpina.com',  at: '2026-08-28T09:20:00.000Z', comment: '', teamLabel: 'Mercadeo' },
    INOCUIDAD:  { decision: 'APROBADO', by: 'Carolina Páez',  email: 'caro@alpina.com',  at: '2026-08-28T14:45:30.000Z', comment: 'Sellos de inocuidad completos — quedó el registro sanitario visible.', teamLabel: 'Inocuidad' },
    DESARROLLO: { decision: 'APROBADO', by: 'Daniel Muñoz',   email: 'dani@alpina.com',  at: '2026-08-29T11:02:07.000Z', comment: '', teamLabel: 'Desarrollo' },
  },
  rejectedByTeamId: null,
  consecutive: 'CP-2026-014', title: 'Bon Yurt Verano — Paquete de artes',
  brand: 'Bon Yurt', product: 'Bon Yurt Clásico', contentType: 'PAQUETE_ARTES',
  area: 'Mercadeo Lácteos', solicitanteName: 'Michael Page', solicitanteEmail: 'michael@alpina.com',
  comiteStatus: 'APROBADA', s3Key: 'App comite publicidad/solicitudes/x/v2_arte.pdf', fileName: 'v2_arte.pdf',
  arteVersion: 2,
  startedAt: '2026-08-27T12:00:00.000Z', createdAt: '2026-08-27T12:00:00.000Z',
  updatedAt: '2026-08-29T11:02:07.000Z', completedAt: '2026-08-29T11:02:07.000Z',
};

const approvals: ArteApproval[] = [
  { solicitudId: flowAprobado.solicitudId, sk: 'approval#01#EMPAQUES#t1', tipo: 'arte-approval', teamId: 'EMPAQUES', teamLabel: 'Empaques', decision: 'APROBADO', approverId: '1', approverName: 'Ana Gómez', approverEmail: 'ana@alpina.com', approverRole: 'SOLICITANTE', comment: 'Ok primera ronda', cycle: 1, arteVersion: 1, at: '2026-08-25T14:00:00.000Z' },
  { solicitudId: flowAprobado.solicitudId, sk: 'approval#01#MERCADEO#t2', tipo: 'arte-approval', teamId: 'MERCADEO', teamLabel: 'Mercadeo', decision: 'RECHAZADO', approverId: '2', approverName: 'Beto Ríos', approverEmail: 'beto@alpina.com', approverRole: 'SOLICITANTE', comment: 'El logo se ve deformado en la pieza 3 y el claim no coincide con la matriz de copys aprobada por legal.', cycle: 1, arteVersion: 1, at: '2026-08-26T10:30:00.000Z' },
  { solicitudId: flowAprobado.solicitudId, sk: 'approval#02#EMPAQUES#t3', tipo: 'arte-approval', teamId: 'EMPAQUES', teamLabel: 'Empaques', decision: 'APROBADO', approverId: '1', approverName: 'Ana Gómez', approverEmail: 'ana@alpina.com', approverRole: 'SOLICITANTE', comment: 'Medidas de empaque validadas.', cycle: 2, arteVersion: 2, at: '2026-08-27T15:04:11.000Z' },
  { solicitudId: flowAprobado.solicitudId, sk: 'approval#02#MERCADEO#t4', tipo: 'arte-approval', teamId: 'MERCADEO', teamLabel: 'Mercadeo', decision: 'APROBADO', approverId: '2', approverName: 'Beto Ríos', approverEmail: 'beto@alpina.com', approverRole: 'SOLICITANTE', comment: '', cycle: 2, arteVersion: 2, at: '2026-08-28T09:20:00.000Z' },
  { solicitudId: flowAprobado.solicitudId, sk: 'approval#02#INOCUIDAD#t5', tipo: 'arte-approval', teamId: 'INOCUIDAD', teamLabel: 'Inocuidad', decision: 'APROBADO', approverId: '3', approverName: 'Carolina Páez', approverEmail: 'caro@alpina.com', approverRole: 'SOLICITANTE', comment: 'Sellos completos', cycle: 2, arteVersion: 2, at: '2026-08-28T14:45:30.000Z' },
  { solicitudId: flowAprobado.solicitudId, sk: 'approval#02#DESARROLLO#t6', tipo: 'arte-approval', teamId: 'DESARROLLO', teamLabel: 'Desarrollo', decision: 'APROBADO', approverId: '4', approverName: 'Daniel Muñoz', approverEmail: 'dani@alpina.com', approverRole: 'SOLICITANTE', comment: '', cycle: 2, arteVersion: 2, at: '2026-08-29T11:02:07.000Z' },
];

/** Simula el arte original que viene de S3 */
async function documentoBase(paginas = 3): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= paginas; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Arte original - pagina ${i}`, { x: 60, y: 780, size: 16, font });
  }
  return doc;
}

async function main() {
  console.log('\n--- Utilidades de la hoja de firmas ---');

  await test('sanitize quita acentos y caracteres no WinAnsi', () => {
    assert.strictEqual(sanitize('Diseño Ñandú — “prueba”'), 'Diseno Nandu - "prueba"');
    assert.strictEqual(sanitize('Carolina Páez'), 'Carolina Paez');
    assert.strictEqual(sanitize(''), '');
  });

  await test('wrapText parte el texto sin exceder el ancho', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lineas = wrapText('El logo se ve deformado en la pieza tres y el claim no coincide', font, 9, 120);
    assert.ok(lineas.length > 1, 'debería partir en varias líneas');
    lineas.forEach(l => assert.ok(font.widthOfTextAtSize(l, 9) <= 120, `línea muy ancha: ${l}`));
  });

  await test('el sello es estable y cambia con las firmas', () => {
    const s1 = selloVerificacion(flowAprobado, approvals);
    const s2 = selloVerificacion(flowAprobado, approvals);
    assert.strictEqual(s1, s2, 'debe ser determinista');
    assert.match(s1, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/, `formato inesperado: ${s1}`);
    const s3 = selloVerificacion(flowAprobado, approvals.slice(0, 3));
    assert.notStrictEqual(s1, s3, 'debe cambiar si cambian las firmas');
  });

  await test('nombreArchivoFirmado usa consecutivo y versión', () => {
    assert.strictEqual(nombreArchivoFirmado(flowAprobado), 'CP-2026-014_v2_firmado.pdf');
  });

  console.log('\n--- Generación del PDF firmado ---');

  await test('agrega la hoja de firmas sin perder el arte original', async () => {
    const doc = await documentoBase(3);
    await appendSignatureSheet(doc, { flow: flowAprobado, approvals, teams });
    assert.ok(doc.getPageCount() > 3, 'debe agregar al menos una página');
    // El arte original se conserva intacto al inicio
    assert.strictEqual(doc.getPage(0).getSize().width, 595, 'la primera página sigue siendo el arte');
    const hoja = doc.getPage(3);
    assert.strictEqual(Math.round(hoja.getSize().width), 612, 'la hoja de firmas es tamaño Letter');
    assert.strictEqual(Math.round(hoja.getSize().height), 792);
  });

  await test('el PDF resultante se serializa y es un PDF válido', async () => {
    const doc = await documentoBase(2);
    await appendSignatureSheet(doc, { flow: flowAprobado, approvals, teams });
    const bytes = await doc.save();
    assert.ok(bytes.length > 3000, 'el PDF parece vacío');
    assert.strictEqual(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-', 'no tiene cabecera PDF');
    // Se puede volver a abrir (no quedó corrupto)
    const reabierto = await PDFDocument.load(bytes);
    assert.strictEqual(reabierto.getPageCount(), doc.getPageCount());

    const out = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'out');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'arte-firmado-prueba.pdf'), bytes);
    console.log(`       archivo de revisión: scripts/out/arte-firmado-prueba.pdf`);
  });

  await test('funciona con firmas pendientes (flujo en curso)', async () => {
    const enCurso: ArteFlow = {
      ...flowAprobado,
      estado: 'EN_CURSO', currentTeamId: 'INOCUIDAD', currentTeamLabel: 'Inocuidad',
      completedAt: null, cycle: 1, arteVersion: 1,
      approvals: {
        EMPAQUES: flowAprobado.approvals.EMPAQUES,
        MERCADEO: flowAprobado.approvals.MERCADEO,
      },
    };
    const doc = await documentoBase(1);
    await appendSignatureSheet(doc, { flow: enCurso, approvals: approvals.slice(0, 2), teams });
    const bytes = await doc.save();
    assert.ok(bytes.length > 3000);
  });

  await test('funciona sin historial ni equipos (usa teamOrder)', async () => {
    const doc = await documentoBase(1);
    await appendSignatureSheet(doc, { flow: flowAprobado, approvals: [], teams: [] });
    assert.ok(doc.getPageCount() >= 2);
  });

  await test('un comentario muy largo no rompe la paginación', async () => {
    const largo = 'x'.repeat(50) + ' texto muy largo repetido '.repeat(40);
    const conNota: ArteFlow = {
      ...flowAprobado,
      approvals: Object.fromEntries(
        Object.entries(flowAprobado.approvals).map(([k, v]) => [k, { ...v, comment: largo }]),
      ) as ArteFlow['approvals'],
    };
    const doc = await documentoBase(1);
    await appendSignatureSheet(doc, {
      flow: conNota,
      approvals: approvals.map(a => ({ ...a, comment: largo })),
      teams,
    });
    const bytes = await doc.save();
    assert.ok(bytes.length > 3000);
    assert.ok(doc.getPageCount() >= 3, 'debería paginar hacia hojas nuevas');
  });

  console.log(`\n${ok} pruebas OK${process.exitCode ? ' (con fallas)' : ''}\n`);
}

main();
