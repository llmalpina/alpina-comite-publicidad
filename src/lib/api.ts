/**
 * Capa de servicios — conecta el frontend con el API Gateway de AWS.
 * Todas las llamadas incluyen el token Cognito en el header Authorization.
 */

const API_URL = import.meta.env.VITE_API_URL as string;
const PRESIGN_URL = import.meta.env.VITE_PRESIGN_URL as string;

export { API_URL };

// ─── Helper base ──────────────────────────────────────────────────────────────

/**
 * Renovación automática del ID token.
 *
 * El ID token de Cognito dura 1 hora; el refresh token, 30 días. Con el JWT
 * Authorizer del API Gateway activo, un token expirado hace que TODAS las
 * llamadas devuelvan 401. Para que la sesión no se "rompa" tras 1 hora con la
 * pestaña abierta, ante un 401 refrescamos el ID token (usando el refresh token)
 * y reintentamos la petición UNA vez, de forma transparente.
 *
 * Se memoiza la promesa de refresh para que varias llamadas que fallen a la vez
 * compartan un único refresh (evita una tormenta de refrescos simultáneos).
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshIdToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('alpina_refresh_token');
      if (!refreshToken) return null;
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, action: 'refresh' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newIdToken = data?.AuthenticationResult?.IdToken;
      if (!newIdToken) return null;
      localStorage.setItem('alpina_id_token', newIdToken);
      const newAccess = data.AuthenticationResult.AccessToken;
      if (newAccess) localStorage.setItem('alpina_access_token', newAccess);
      return newIdToken;
    } catch {
      return null;
    } finally {
      // Libera el memo en el siguiente tick para que reintentos concurrentes lo compartan.
      setTimeout(() => { refreshPromise = null; }, 0);
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
  const token = localStorage.getItem('alpina_id_token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  // 401 (token expirado): intenta refrescar UNA vez y reintentar de forma transparente.
  if (res.status === 401 && !_isRetry) {
    const newToken = await refreshIdToken();
    if (newToken) return apiFetch<T>(path, options, true);
    // No se pudo refrescar (refresh token vencido): sesión terminada.
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Solicitudes ──────────────────────────────────────────────────────────────

export const solicitudesApi = {
  list: () => apiFetch<any[]>('/solicitudes'),
  /**
   * Lista "ligera": el backend omite campos pesados (annotations, comments,
   * versions, iaResult, description, files). Úsala cuando solo necesitas datos
   * de cabecera para listar/filtrar; reduce el payload de ~MB a KB.
   */
  listLight: () => apiFetch<any[]>('/solicitudes?fields=light'),
  get: (id: string) => apiFetch<any>(`/solicitudes/${id}`),
  create: (data: any) => apiFetch<any>('/solicitudes', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string, nota?: string, files?: any[], currentVersion?: number) =>
    apiFetch<any>(`/solicitudes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, nota, files, currentVersion, ...getUserIdentity() }) }),
  /** Corrige el tipo de pieza/contenido de una solicitud (requiere permiso 'editar_tipo_pieza'). */
  updateContentType: (id: string, contentType: string) =>
    apiFetch<any>(`/solicitudes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ contentType, ...getUserIdentity() }) }),
};

// ─── Comentarios ─────────────────────────────────────────────────────────────

export const comentariosApi = {
  list: (solicitudId: string) => apiFetch<any[]>(`/solicitudes/${solicitudId}/comentarios`),
  create: (solicitudId: string, data: { text: string; userName?: string; userRole?: string; area?: string; imageKey?: string }) =>
    apiFetch<any>(`/solicitudes/${solicitudId}/comentarios`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Anotaciones PDF ─────────────────────────────────────────────────────────

export const anotacionesApi = {
  list: (solicitudId: string) => apiFetch<any[]>(`/solicitudes/${solicitudId}/anotaciones`),
  create: (solicitudId: string, data: { text: string; page: number; x: number; y: number; userName?: string; userRole?: string; area?: string; x2?: number; y2?: number; tool?: string; color?: string; points?: { x: number; y: number }[] }) =>
    apiFetch<any>(`/solicitudes/${solicitudId}/anotaciones`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (solicitudId: string, sk: string) =>
    apiFetch<any>(`/solicitudes/${solicitudId}/anotaciones`, { method: 'PATCH', body: JSON.stringify({ sk, active: false }) }),
  update: (solicitudId: string, sk: string, text: string) =>
    apiFetch<any>(`/solicitudes/${solicitudId}/anotaciones`, { method: 'PATCH', body: JSON.stringify({ sk, text }) }),
};

// ─── Versiones de documentos ─────────────────────────────────────────────────

export const versionesApi = {
  list: (solicitudId: string) => apiFetch<any[]>(`/solicitudes/${solicitudId}/versiones`),
  create: (solicitudId: string, data: { s3Key: string; fileName: string; fileSize: number; versionNumber: number; changeNote?: string }) =>
    apiFetch<any>(`/solicitudes/${solicitudId}/versiones`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Maestros ────────────────────────────────────────────────────────────────

/** Identidad del usuario actual, para auditoría en el backend (log de peticiones). */
export function getUserIdentity(): { _userId?: string; _email?: string; _userName?: string; _role?: string } {
  try {
    const devUser = localStorage.getItem('alpina_dev_user');
    if (devUser) {
      const u = JSON.parse(devUser);
      return { _userId: u.id, _email: u.email, _userName: u.name, _role: u.role };
    }
    const token = localStorage.getItem('alpina_id_token');
    if (token) {
      const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return { _userId: p.sub, _email: p.email, _userName: p.name || p['cognito:username'], _role: p['custom:role'] };
    }
  } catch {}
  return {};
}

function getUserRole(): string {
  try {
    const devUser = localStorage.getItem('alpina_dev_user');
    if (devUser) return JSON.parse(devUser).role || 'SOLICITANTE';
    const token = localStorage.getItem('alpina_id_token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload['custom:role'] || 'SOLICITANTE';
    }
  } catch {}
  return 'SOLICITANTE';
}

export const maestrosApi = {
  list: (tipo: string) => apiFetch<any[]>(`/maestros/${tipo}`),
  create: (tipo: string, data: { label: string; value: string }) =>
    apiFetch<any>(`/maestros/${tipo}`, { method: 'POST', body: JSON.stringify({ ...data, _role: getUserRole() }) }),
  update: (tipo: string, id: string, data: any) =>
    apiFetch<any>(`/maestros/${tipo}/${id}`, { method: 'PUT', body: JSON.stringify({ ...data, _role: getUserRole() }) }),
  remove: (tipo: string, id: string) =>
    apiFetch<void>(`/maestros/${tipo}/${id}`, { method: 'DELETE', body: JSON.stringify({ _role: getUserRole() }) }),
  getPromptIA: () => apiFetch<{ prompt: string }>('/maestros/prompt-ia'),
  updatePromptIA: (prompt: string) =>
    apiFetch<any>('/maestros/prompt-ia', { method: 'PUT', body: JSON.stringify({ prompt, _role: getUserRole() }) }),
};

// ─── Usuarios ────────────────────────────────────────────────────────────────

export const usuariosApi = {
  list: () => apiFetch<any[]>('/usuarios'),
  create: (data: { name: string; email: string; role: string; area: string }) =>
    apiFetch<any>('/usuarios', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, role: string) =>
    apiFetch<any>(`/usuarios/${id}/rol`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  updateArea: (id: string, area: string) =>
    apiFetch<any>(`/usuarios/${id}/area`, { method: 'PATCH', body: JSON.stringify({ area }) }),
  disable: (id: string) =>
    apiFetch<any>(`/usuarios/${id}/disable`, { method: 'PATCH' }),
  resetPassword: (id: string) =>
    apiFetch<{ message: string }>(`/usuarios/${id}/reset-password`, { method: 'PATCH' }),
  update: (id: string, data: { name?: string; email?: string; role?: string; area?: string }) =>
    apiFetch<any>(`/usuarios/${id}/editar`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    apiFetch<{ message: string }>(`/usuarios/${id}`, { method: 'DELETE' }),

  // ─── Webhook personal de Google Chat (cada usuario configura el suyo) ───
  /** Lee el webhook personal del usuario actual. El backend lo identifica por el token. */
  getMiWebhook: () =>
    apiFetch<{ ok: boolean; chatWebhook: string }>(`/usuarios/me/mi-webhook`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true, ...getUserIdentity() }),
    }),
  /** Guarda (o vacía) el webhook personal del usuario actual. */
  setMiWebhook: (chatWebhook: string) =>
    apiFetch<{ ok: boolean; chatWebhook: string }>(`/usuarios/me/mi-webhook`, {
      method: 'PATCH',
      body: JSON.stringify({ chatWebhook, ...getUserIdentity() }),
    }),
};

// ─── S3 Presigned URL ────────────────────────────────────────────────────────

export async function getPresignedUploadUrl(key: string): Promise<string> {
  const token = localStorage.getItem('alpina_id_token');
  const res = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: 'upload', key, contentType: 'application/pdf' }),
  });
  const data = await res.json();
  return data.url;
}

export async function uploadFileToS3(presignedUrl: string, file: File): Promise<void> {
  await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  });
}

// ─── Image Upload for Comments/Annotations ────────────────────────────────────

/**
 * Upload an image to S3 for a comment/annotation.
 * Returns the S3 key for the uploaded image.
 */
export async function uploadCommentImage(solicitudId: string, file: File): Promise<string> {
  const token = localStorage.getItem('alpina_id_token');
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `comment_${Date.now()}.${ext}`;
  
  // Get presigned URL for image upload
  const presignRes = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      action: 'upload-image',
      solicitudId,
      fileName,
      contentType: file.type || 'image/png',
    }),
  });
  
  if (!presignRes.ok) throw new Error('Error al obtener URL de subida');
  const { url, key } = await presignRes.json();
  
  // Upload the image
  const uploadRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'image/png' },
    body: file,
  });
  
  if (!uploadRes.ok) throw new Error('Error al subir imagen');
  return key;
}

/**
 * Get a presigned download URL for an image by its S3 key.
 */
export async function getImageUrl(key: string): Promise<string> {
  const token = localStorage.getItem('alpina_id_token');
  const res = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: 'download', key }),
  });
  if (!res.ok) throw new Error('Error al obtener URL de imagen');
  const data = await res.json();
  return data.url;
}
