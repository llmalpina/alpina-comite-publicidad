/**
 * Servicio de correos — llama a la Lambda SES directamente via Lambda URL.
 * Mientras no hay API Gateway desplegado, usa la URL de la lambda directamente.
 */

const SES_URL = import.meta.env.VITE_SES_URL as string;

interface EmailPayload {
  template: 'nueva_solicitud' | 'cambio_estado' | 'nuevo_comentario' | 'aprobacion_parcial';
  to: string | string[];
  data: Record<string, any>;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!SES_URL) {
    console.warn('[email] VITE_SES_URL no configurado — correo no enviado:', payload.template, payload.to);
    return;
  }
  try {
    const token = localStorage.getItem('alpina_id_token');
    await fetch(SES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[email] Error enviando correo:', err);
  }
}

// ─── Helpers por evento ───────────────────────────────────────────────────────

export function emailNuevaSolicitud(solicitud: any, destinatarios: string[]) {
  return sendEmail({
    template: 'nueva_solicitud',
    to: destinatarios,
    data: {
      id: solicitud.id,
      consecutive: solicitud.consecutive,
      title: solicitud.title,
      brand: solicitud.brand,
      solicitanteName: solicitud.solicitanteName,
      area: solicitud.area,
      deadline: solicitud.deadline ? new Date(solicitud.deadline).toLocaleDateString('es-CO') : '—',
    },
  });
}

export function emailCambioEstado(solicitud: any, statusLabel: string, nota?: string) {
  if (!solicitud.solicitanteEmail) return Promise.resolve();
  return sendEmail({
    template: 'cambio_estado',
    to: solicitud.solicitanteEmail,
    data: {
      id: solicitud.id,
      consecutive: solicitud.consecutive,
      title: solicitud.title,
      brand: solicitud.brand,
      solicitanteName: solicitud.solicitanteName,
      status: solicitud.status,
      statusLabel,
      nota,
    },
  });
}

export function emailNuevoComentario(solicitud: any, comentario: any) {
  if (!solicitud.solicitanteEmail) return Promise.resolve();
  return sendEmail({
    template: 'nuevo_comentario',
    to: solicitud.solicitanteEmail,
    data: {
      id: solicitud.id,
      title: solicitud.title,
      solicitanteName: solicitud.solicitanteName,
      commentAuthor: comentario.userName,
      commentArea: comentario.area || '',
      commentText: comentario.text,
    },
  });
}
