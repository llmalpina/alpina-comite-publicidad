/**
 * Capa de servicios — conecta el frontend con el API Gateway de AWS.
 * Todas las llamadas incluyen el token Cognito en el header Authorization.
 */

const API_URL = import.meta.env.VITE_API_URL as string;
const PRESIGN_URL = import.meta.env.VITE_PRESIGN_URL as string;

export { API_URL };

// ─── Helper base ──────────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('alpina_id_token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
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
  get: (id: string) => apiFetch<any>(`/solicitudes/${id}`),
  create: (data: any) => apiFetch<any>('/solicitudes', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string, nota?: string, files?: any[], currentVersion?: number) =>
    apiFetch<any>(`/solicitudes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, nota, files, currentVersion }) }),
};

// ─── Comentarios ─────────────────────────────────────────────────────────────

export const comentariosApi = {
  list: (solicitudId: string) => apiFetch<any[]>(`/solicitudes/${solicitudId}/comentarios`),
  create: (solicitudId: string, data: { text: string; userName?: string; userRole?: string; area?: string }) =>
    apiFetch<any>(`/solicitudes/${solicitudId}/comentarios`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Anotaciones PDF ─────────────────────────────────────────────────────────

export const anotacionesApi = {
  list: (solicitudId: string) => apiFetch<any[]>(`/solicitudes/${solicitudId}/anotaciones`),
  create: (solicitudId: string, data: { text: string; page: number; x: number; y: number; userName?: string; userRole?: string; area?: string; x2?: number; y2?: number; tool?: string; color?: string; points?: { x: number; y: number }[] }) =>
    apiFetch<any>(`/solicitudes/${solicitudId}/anotaciones`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Versiones de documentos ─────────────────────────────────────────────────

export const versionesApi = {
  list: (solicitudId: string) => apiFetch<any[]>(`/solicitudes/${solicitudId}/versiones`),
  create: (solicitudId: string, data: { s3Key: string; fileName: string; fileSize: number; versionNumber: number; changeNote?: string }) =>
    apiFetch<any>(`/solicitudes/${solicitudId}/versiones`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Maestros ────────────────────────────────────────────────────────────────

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
  disable: (id: string) =>
    apiFetch<any>(`/usuarios/${id}/disable`, { method: 'PATCH' }),
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
