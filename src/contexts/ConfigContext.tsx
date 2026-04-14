/**
 * ConfigContext — configuración de correos y roles/permisos.
 *
 * Persistencia:
 *   - Con API configurada: DynamoDB via lambda-maestros
 *     tipo = 'config-email'  | id = 'singleton'
 *     tipo = 'config-roles'  | id = 'singleton'
 *   - Sin API (dev local): localStorage como fallback
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PermissionKey =
  | 'crear_solicitud'
  | 'ver_solicitudes_propias'
  | 'ver_todas_solicitudes'
  | 'revisar_solicitud'
  | 'aprobar_rechazar'
  | 'agregar_comentario'
  | 'agregar_anotacion_pdf'
  | 'subir_version'
  | 'subir_fuera_horario'
  | 'ver_reportes'
  | 'gestionar_maestros'
  | 'gestionar_usuarios'
  | 'gestionar_roles'
  | 'configurar_correos';

export interface RoleConfig {
  id: string;
  name: string;
  label: string;
  color: string;
  permissions: PermissionKey[];
  editable: boolean;
}

export interface EmailConfig {
  smtpHost:     string;
  smtpPort:     number;
  smtpUser:     string;
  smtpPassword: string;
  fromName:     string;
  rules: NotificationRule[];
}

export interface ScheduleConfig {
  enabled: boolean;
  cutoffHour: number;
  cutoffMinute: number;
  allowedDays: number[];
  message: string;
  /** Recordatorio semanal de piezas pendientes */
  reminderEnabled: boolean;
  reminderDay: number;     // 0=dom, 1=lun, ..., 6=sáb
  reminderHour: number;
  reminderMinute: number;
}

/** Una regla define: qué evento → quién recibe el correo */
export interface NotificationRule {
  id: string;
  enabled: boolean;
  event: NotificationEvent;
  /** Roles que reciben el correo (se resuelven a emails en runtime) */
  toRoles: string[];
  /** Emails adicionales fijos */
  toEmails: string[];
  /** Emails en copia */
  cc: string[];
  label: string;
  description: string;
  /** Si true, no se puede eliminar (regla del sistema) */
  system: boolean;
}

export type NotificationEvent =
  | 'solicitud_creada'
  | 'solicitud_aprobacion_parcial'
  | 'solicitud_aprobada'
  | 'solicitud_con_observaciones'
  | 'solicitud_rechazada'
  | 'comentario_agregado'
  | 'nueva_version_subida'
  | 'recordatorio_pendientes'
  | 'usuario_creado';

interface ConfigContextType {
  roles: RoleConfig[];
  emailConfig: EmailConfig;
  scheduleConfig: ScheduleConfig;
  loadingConfig: boolean;
  hasPermission: (roleId: string, permission: PermissionKey) => boolean;
  canSubmitNow: (roleId: string) => { allowed: boolean; message?: string };
  updateRole: (role: RoleConfig) => void;
  addRole: (name: string, label: string, color: string) => void;
  removeRole: (id: string) => void;
  togglePermission: (roleId: string, permission: PermissionKey) => void;
  updateEmailConfig: (config: Partial<EmailConfig>) => Promise<void>;
  updateScheduleConfig: (config: Partial<ScheduleConfig>) => Promise<void>;
  updateRule: (rule: NotificationRule) => Promise<void>;
  addRule: (rule: Omit<NotificationRule, 'id' | 'system'>) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const ALL_PERMISSIONS: PermissionKey[] = [
  'crear_solicitud', 'ver_solicitudes_propias', 'ver_todas_solicitudes',
  'revisar_solicitud', 'aprobar_rechazar', 'agregar_comentario',
  'agregar_anotacion_pdf', 'subir_version', 'subir_fuera_horario', 'ver_reportes',
  'gestionar_maestros', 'gestionar_usuarios', 'gestionar_roles', 'configurar_correos',
];

const DEFAULT_ROLES: RoleConfig[] = [
  { id: 'SOLICITANTE',   name: 'SOLICITANTE',   label: 'Solicitante',   color: 'bg-blue-100 text-blue-700',   editable: false, permissions: ['crear_solicitud', 'ver_solicitudes_propias', 'agregar_comentario', 'subir_version'] },
  { id: 'REVISOR_ARA',   name: 'REVISOR_ARA',   label: 'Revisor ARA',   color: 'bg-purple-100 text-purple-700', editable: false, permissions: ['ver_todas_solicitudes', 'revisar_solicitud', 'aprobar_rechazar', 'agregar_comentario', 'agregar_anotacion_pdf'] },
  { id: 'REVISOR_LEGAL', name: 'REVISOR_LEGAL', label: 'Revisor Legal', color: 'bg-amber-100 text-amber-700',  editable: false, permissions: ['ver_todas_solicitudes', 'revisar_solicitud', 'aprobar_rechazar', 'agregar_comentario', 'agregar_anotacion_pdf'] },
  { id: 'ADMIN',         name: 'ADMIN',         label: 'Administrador', color: 'bg-slate-200 text-slate-700',  editable: false, permissions: ALL_PERMISSIONS },
];

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: true,
  cutoffHour: 17,
  cutoffMinute: 0,
  allowedDays: [1, 2, 3, 4, 5],
  message: 'El horario de envio de piezas es de lunes a viernes hasta las 5:00 PM.',
  reminderEnabled: true,
  reminderDay: 1,
  reminderHour: 8,
  reminderMinute: 0,
};

const DEFAULT_EMAIL: EmailConfig = {
  smtpHost:     'smtp.office365.com',
  smtpPort:     587,
  smtpUser:     'asist.auto@alpina.com',
  smtpPassword: 'AlpinitoOctubre2025.',
  fromName:     'Comité Publicidad Alpina',
  rules: [
    {
      id: 'rule-1', system: true, enabled: true,
      event: 'solicitud_creada',
      label: 'Nueva solicitud creada',
      description: 'Cuando un solicitante crea una solicitud, notifica a los revisores.',
      toRoles: ['REVISOR_ARA', 'REVISOR_LEGAL'],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
    {
      id: 'rule-2', system: true, enabled: true,
      event: 'solicitud_aprobacion_parcial',
      label: 'Aprobación parcial (un equipo)',
      description: 'Cuando ARA o Legal aprueba pero falta el otro equipo, notifica al solicitante y al equipo pendiente.',
      toRoles: ['SOLICITANTE'],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
    {
      id: 'rule-3', system: true, enabled: true,
      event: 'solicitud_aprobada',
      label: 'Pieza revisada — sin comentarios',
      description: 'Cuando ambos equipos revisan sin observaciones, notifica al solicitante.',
      toRoles: ['SOLICITANTE'],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
    {
      id: 'rule-3b', system: true, enabled: true,
      event: 'solicitud_con_observaciones',
      label: 'Pieza revisada — con comentarios',
      description: 'Cuando ambos equipos revisan pero hay observaciones, notifica al solicitante que debe subir pieza final.',
      toRoles: ['SOLICITANTE'],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
    {
      id: 'rule-4', system: true, enabled: true,
      event: 'solicitud_rechazada',
      label: 'Pieza rechazada',
      description: 'Cuando ARA o Legal rechazan, notifica al solicitante.',
      toRoles: ['SOLICITANTE'],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
    {
      id: 'rule-5', system: true, enabled: true,
      event: 'comentario_agregado',
      label: 'Nuevo comentario del comité',
      description: 'Cuando ARA o Legal dejan un comentario, notifica al solicitante.',
      toRoles: ['SOLICITANTE'],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
    {
      id: 'rule-6', system: false, enabled: true,
      event: 'nueva_version_subida',
      label: 'Nueva versión del documento',
      description: 'Cuando el solicitante sube una corrección, notifica a los revisores.',
      toRoles: ['REVISOR_ARA', 'REVISOR_LEGAL'],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
    {
      id: 'rule-7', system: false, enabled: true,
      event: 'usuario_creado',
      label: 'Bienvenida a nuevo usuario',
      description: 'Cuando se crea un usuario, le envía sus credenciales.',
      toRoles: [],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
    {
      id: 'rule-8', system: true, enabled: true,
      event: 'recordatorio_pendientes',
      label: 'Recordatorio semanal de piezas pendientes',
      description: 'Envía un correo a los solicitantes con piezas pendientes de subir o publicar. Se configura el día y hora en la pestaña Horario.',
      toRoles: ['SOLICITANTE'],
      toEmails: [],
      cc: ['nicolas.carreno@alpina.com'],
    },
  ],
};

// ─── Helpers DynamoDB via API ─────────────────────────────────────────────────

const API_BASE = (import.meta as any).env?.VITE_API_URL as string || '';

async function fetchFromDynamo<T>(tipo: string, fallback: T): Promise<T> {
  try {
    const token = localStorage.getItem('alpina_id_token');
    const res = await fetch(`${API_BASE}/maestros/${tipo}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return fallback;
    const items = await res.json();
    const singleton = items.find((i: any) => i.id === 'singleton');
    return singleton ? (singleton.value as T) : fallback;
  } catch {
    return fallback;
  }
}

async function saveToDynamo(tipo: string, value: any): Promise<void> {
  const token = localStorage.getItem('alpina_id_token');
  // Determina el rol: primero de dev user, luego del token Cognito
  const devUser = localStorage.getItem('alpina_dev_user');
  let role: string | undefined;
  if (devUser) {
    try { role = JSON.parse(devUser).role; } catch {}
  }
  if (!role && token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      role = payload['custom:role'];
    } catch {}
  }
  await fetch(`${API_BASE}/maestros/${tipo}/singleton`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ id: 'singleton', tipo, value, updatedAt: new Date().toISOString(), _role: role || 'ADMIN' }),
  });
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roles, setRoles] = useState<RoleConfig[]>(DEFAULT_ROLES);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(DEFAULT_EMAIL);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(() => {
    try {
      const saved = localStorage.getItem('alpina_schedule_config');
      return saved ? JSON.parse(saved) : DEFAULT_SCHEDULE;
    } catch { return DEFAULT_SCHEDULE; }
  });
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Al montar: carga desde DynamoDB con timeout de 3s, si falla usa defaults
  useEffect(() => {
    const load = async () => {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        );
        const [dbRoles, dbEmail, dbSchedule] = await Promise.race([
          Promise.all([
            fetchFromDynamo<RoleConfig[]>('config-roles', DEFAULT_ROLES),
            fetchFromDynamo<EmailConfig>('config-email', DEFAULT_EMAIL),
            fetchFromDynamo<ScheduleConfig>('config-schedule', DEFAULT_SCHEDULE),
          ]),
          timeout,
        ]) as [RoleConfig[], EmailConfig, ScheduleConfig];
        setRoles(dbRoles);
        setEmailConfig(dbEmail);
        setScheduleConfig(dbSchedule);
      } catch {
        // Timeout o error — intenta cargar schedule desde localStorage
        try {
          const saved = localStorage.getItem('alpina_schedule_config');
          if (saved) setScheduleConfig(JSON.parse(saved));
        } catch { /* usa defaults */ }
      } finally {
        setLoadingConfig(false);
      }
    };
    load();
  }, []);

  const persistRoles = async (next: RoleConfig[]) => {
    setRoles(next);
    await saveToDynamo('config-roles', next);
  };

  const persistEmail = async (next: EmailConfig) => {
    setEmailConfig(next);
    await saveToDynamo('config-email', next);
  };

  const persistSchedule = async (next: ScheduleConfig) => {
    setScheduleConfig(next);
    localStorage.setItem('alpina_schedule_config', JSON.stringify(next));
    await saveToDynamo('config-schedule', next);
  };

  const canSubmitNow = (roleId: string): { allowed: boolean; message?: string } => {
    if (!scheduleConfig.enabled) return { allowed: true };
    if (hasPermission(roleId, 'subir_fuera_horario')) return { allowed: true };
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (!scheduleConfig.allowedDays.includes(day)) {
      return { allowed: false, message: scheduleConfig.message || 'No se pueden enviar piezas hoy.' };
    }
    const currentMinutes = hour * 60 + minute;
    const cutoffMinutes = scheduleConfig.cutoffHour * 60 + scheduleConfig.cutoffMinute;
    if (currentMinutes >= cutoffMinutes) {
      const h = String(scheduleConfig.cutoffHour).padStart(2, '0');
      const m = String(scheduleConfig.cutoffMinute).padStart(2, '0');
      return { allowed: false, message: scheduleConfig.message || `El horario de envío es hasta las ${h}:${m}.` };
    }
    return { allowed: true };
  };

  const hasPermission = (roleId: string, permission: PermissionKey) =>
    roles.find(r => r.id === roleId)?.permissions.includes(permission) ?? false;

  const updateRole = (role: RoleConfig) =>
    persistRoles(roles.map(r => r.id === role.id ? role : r));

  const addRole = (name: string, label: string, color: string) => {
    const newRole: RoleConfig = {
      id: `CUSTOM_${Date.now()}`,
      name: name.toUpperCase().replace(/\s+/g, '_'),
      label, color,
      permissions: ['agregar_comentario'],
      editable: true,
    };
    persistRoles([...roles, newRole]);
  };

  const removeRole = (id: string) =>
    persistRoles(roles.filter(r => r.id !== id || !r.editable));

  const togglePermission = (roleId: string, permission: PermissionKey) =>
    persistRoles(roles.map(r => {
      if (r.id !== roleId) return r;
      const has = r.permissions.includes(permission);
      return { ...r, permissions: has ? r.permissions.filter(p => p !== permission) : [...r.permissions, permission] };
    }));

  const updateEmailConfig = async (partial: Partial<EmailConfig>) => {
    await persistEmail({ ...emailConfig, ...partial });
  };

  const updateScheduleConfig = async (partial: Partial<ScheduleConfig>) => {
    await persistSchedule({ ...scheduleConfig, ...partial });
  };

  const updateRule = async (rule: NotificationRule) => {
    const next = { ...emailConfig, rules: emailConfig.rules.map(r => r.id === rule.id ? rule : r) };
    await persistEmail(next);
  };

  const addRule = async (rule: Omit<NotificationRule, 'id' | 'system'>) => {
    const newRule: NotificationRule = { ...rule, id: `rule-${Date.now()}`, system: false };
    const next = { ...emailConfig, rules: [...emailConfig.rules, newRule] };
    await persistEmail(next);
  };

  const removeRule = async (id: string) => {
    const next = { ...emailConfig, rules: emailConfig.rules.filter(r => r.id !== id || r.system) };
    await persistEmail(next);
  };

  return (
    <ConfigContext.Provider value={{ roles, emailConfig, scheduleConfig, loadingConfig, hasPermission, canSubmitNow, updateRole, addRole, removeRole, togglePermission, updateEmailConfig, updateScheduleConfig, updateRule, addRule, removeRule }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
};
