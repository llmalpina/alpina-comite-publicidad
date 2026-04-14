/**
 * Servicios frontend: correo (SMTP via Lambda) y análisis IA (Bedrock Lambda).
 * Usa Lambda URLs directas configuradas en .env.local.
 * Cuando no están configuradas, opera en modo silencioso.
 */

const SES_URL     = import.meta.env.VITE_SES_LAMBDA_URL as string;
const BEDROCK_URL = import.meta.env.VITE_BEDROCK_LAMBDA_URL as string;

// ─── Correo ───────────────────────────────────────────────────────────────────

export interface EmailPayload {
  template: 'nueva_solicitud' | 'cambio_estado' | 'nuevo_comentario' | 'aprobacion_parcial';
  to: string | string[];
  cc?: string | string[];
  data: Record<string, any>;
  /** Config SMTP — se pasa desde ConfigContext para que la lambda use los valores actuales */
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    password: string;
    fromName: string;
  };
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!SES_URL) {
    // Modo dev: loguea el correo que se habría enviado
    console.group(`📧 [CORREO DEV] ${payload.template}`);
    console.log('Para:', payload.to);
    if (payload.cc) console.log('CC:', payload.cc);
    console.log('Datos:', payload.data);
    console.groupEnd();
    return;
  }
  try {
    const token = localStorage.getItem('alpina_id_token');
    const res = await fetch(SES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[SMTP] Error:', err.message || res.status);
    } else {
      console.info(`[SMTP] Correo enviado: ${payload.template} → ${payload.to}`);
    }
  } catch (e) {
    console.error('[SMTP] Error enviando correo:', e);
  }
}

// ─── Bedrock ──────────────────────────────────────────────────────────────────

export interface BedrockResult {
  score: number;
  observations: Array<{
    id: string;
    category: 'LEGAL' | 'NUTRICIONAL' | 'MARCA' | 'REDACCION';
    severity: 'ERROR' | 'WARNING' | 'INFO';
    message: string;
    ruleReference?: string;
    suggestion?: string;
  }>;
}

export async function analizarConBedrock(
  file: File,
  solicitudInfo: { brand: string; product: string; channel: string; contentType: string; description: string },
  promptIA: string
): Promise<BedrockResult | null> {
  if (!BEDROCK_URL) {
    console.info('[Bedrock] Lambda URL no configurada — análisis omitido');
    return null;
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  const pdfBase64 = btoa(binary);

  const token = localStorage.getItem('alpina_id_token');
  const res = await fetch(BEDROCK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ pdfBase64, prompt: promptIA, solicitudInfo }),
  });

  if (!res.ok) throw new Error(`Bedrock error: ${res.status}`);
  return res.json();
}

// ─── Motor de reglas de notificación ─────────────────────────────────────────

import type { NotificationEvent, EmailConfig } from '../contexts/ConfigContext';
import { MOCK_USERS } from './mock-data';

/**
 * Construye el mapa rol → emails desde los usuarios mock (modo dev)
 * o desde la lista de usuarios reales (prod).
 */
function buildRoleEmailsFromMock(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const u of MOCK_USERS) {
    if (!map[u.role]) map[u.role] = [];
    if (u.email) map[u.role].push(u.email);
  }
  return map;
}

/**
 * Dispara las reglas de notificación para un evento dado.
 * En modo dev resuelve roles usando MOCK_USERS.
 * En prod recibe el mapa roleEmails desde la API.
 */
export async function dispararRegla(
  event: NotificationEvent,
  emailConfig: EmailConfig,
  data: Record<string, any>,
  /** Mapa rol → emails. Si no se pasa, usa MOCK_USERS en dev. */
  roleEmails?: Record<string, string[]>
): Promise<void> {
  const reglas = emailConfig.rules.filter(r => r.enabled && r.event === event);
  if (reglas.length === 0) return;

  // Resuelve el mapa de roles si no viene del exterior
  const resolvedRoleEmails = roleEmails ?? buildRoleEmailsFromMock();

  for (const regla of reglas) {
    const toByRole = regla.toRoles.flatMap(role => resolvedRoleEmails[role] || []);
    const to = [...new Set([...toByRole, ...regla.toEmails])];
    const cc = regla.cc.length > 0 ? regla.cc : undefined;

    // Si no hay destinatarios directos pero hay CC, usar CC como destinatario principal
    const finalTo = to.length > 0 ? to : (cc ?? []);
    const finalCc = to.length > 0 ? cc : undefined;

    if (finalTo.length === 0) {
      console.warn(`[Regla "${regla.label}"] Sin destinatarios para el evento ${event}`);
      continue;
    }

    const templateMap: Partial<Record<NotificationEvent, EmailPayload['template']>> = {
      solicitud_creada:             'nueva_solicitud',
      solicitud_aprobacion_parcial: 'aprobacion_parcial',
      solicitud_aprobada:           'cambio_estado',
      solicitud_con_observaciones:  'cambio_estado',
      solicitud_rechazada:          'cambio_estado',
      comentario_agregado:          'nuevo_comentario',
      recordatorio_pendientes:      'recordatorio_pendientes',
    };

    const template = templateMap[event];
    if (!template) continue;

    await sendEmail({ template, to: finalTo, cc: finalCc, data });
  }
}
