/**
 * Tipos del flujo de aprobación de artes por equipos.
 *
 * Es un módulo independiente del comité: aplica a las piezas cuyo tipo de
 * contenido esté habilitado en la configuración (por defecto "Paquete de artes
 * de una marca") y arranca cuando el comité (ARA + Legal) ya aprobó la pieza.
 */

/** Estado del flujo de firmas de un arte */
export type ArteEstado = 'EN_CURSO' | 'DEVUELTO_DISENO' | 'APROBADO' | 'CANCELADO';

/** Decisión de un equipo sobre un arte */
export type ArteDecision = 'APROBADO' | 'RECHAZADO';

/** Integrante de un equipo: recibe los correos del flujo */
export interface ArteTeamMember {
  name: string;
  email: string;
}

/** Equipo que firma (o, si isDesign, que hace los ajustes) */
export interface ArteTeam {
  id: string;
  label: string;
  /** Posición en la secuencia de firmas (menor primero) */
  order: number;
  activo: boolean;
  /** El equipo de Diseño no firma: recibe las devoluciones y sube ajustes */
  isDesign: boolean;
  color: string;
  members: ArteTeamMember[];
}

/** Recordatorio periódico de pendientes (día y hora configurables) */
export interface ArteReminderConfig {
  enabled: boolean;
  /** 0=domingo … 6=sábado */
  day: number;
  hour: number;
  minute: number;
  /** Offset horario para evaluar el disparo (-5 = America/Bogotá) */
  timezoneOffset: number;
  ccEmails: string[];
}

export interface ArtesConfig {
  enabled: boolean;
  /** Tipos de contenido que entran al flujo */
  contentTypes: string[];
  /** Estados del comité que disparan el flujo */
  startOnStatuses: string[];
  /**
   * Qué pasa cuando Diseño sube una corrección:
   *  FIRST     → el ciclo reinicia desde el primer equipo
   *  REJECTING → retoma en el equipo que devolvió el arte
   */
  onRejectRestart: 'FIRST' | 'REJECTING';
  /** Si true, cualquier integrante del equipo puede firmar; si false, solo el asignado. */
  anyMemberCanSign?: boolean;
  /** Copia para todos los correos del flujo */
  ccEmails: string[];
  teams: ArteTeam[];
  reminder: ArteReminderConfig;
}

/** Resumen de la firma de un equipo dentro del ciclo actual */
export interface ArteApprovalSummary {
  decision: ArteDecision;
  by: string;
  email: string;
  at: string;
  comment: string;
  teamLabel: string;
}

/** Estado del flujo de un arte (un registro por solicitud) */
export interface ArteFlow {
  solicitudId: string;
  sk: 'flow';
  tipo: 'arte-flow';
  estado: ArteEstado;
  /** Secuencia de equipos capturada al iniciar el flujo */
  teamOrder: string[];
  currentTeamId: string | null;
  currentTeamLabel: string | null;
  /** Número de ronda: sube cada vez que Diseño sube un ajuste */
  cycle: number;
  approvals: Record<string, ArteApprovalSummary>;
  /** Integrante asignado por equipo para firmar (correo). Opcional. */
  assignees?: Record<string, string>;
  rejectedByTeamId: string | null;
  // datos de la solicitud, desnormalizados para listar y filtrar
  consecutive: string;
  title: string;
  brand: string;
  product: string;
  contentType: string;
  area: string;
  solicitanteName: string;
  solicitanteEmail: string;
  comiteStatus: string;
  s3Key: string;
  fileName: string;
  arteVersion: number;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Registro de auditoría de cada decisión (inmutable) */
export interface ArteApproval {
  solicitudId: string;
  sk: string;
  tipo: 'arte-approval';
  teamId: string;
  teamLabel: string;
  decision: ArteDecision;
  approverId: string;
  approverName: string;
  approverEmail: string;
  approverRole: string;
  comment: string;
  cycle: number;
  arteVersion: number;
  at: string;
}

/** Versión del arte subida por Diseño */
export interface ArteVersion {
  solicitudId: string;
  sk: string;
  tipo: 'arte-version';
  id: string;
  versionNumber: number;
  s3Key: string;
  fileName: string;
  fileSize: number;
  changeNote: string;
  userId: string;
  userName: string;
  userEmail: string;
  cycle: number;
  uploadedAt: string;
}

/** Equipo tal como lo devuelve el backend en las respuestas de lista/detalle */
export interface ArteTeamRef {
  id: string;
  label: string;
  isDesign?: boolean;
  order?: number;
  color?: string;
}

export interface ArtesListResponse {
  items: ArteFlow[];
  myTeams: ArteTeamRef[];
  isAdmin: boolean;
  teams: ArteTeamRef[];
}

export interface ArteDetailResponse {
  flow: ArteFlow;
  approvals: ArteApproval[];
  versions: ArteVersion[];
  myTeams: ArteTeamRef[];
  isAdmin: boolean;
  teams: ArteTeamRef[];
  designTeam: ArteTeam | null;
  /** Si cualquier integrante del equipo puede firmar (config del flujo). */
  anyMemberCanSign?: boolean;
  /** Si el usuario actual puede firmar por el equipo del turno. */
  callerCanSign?: boolean;
}

/** Etiquetas y colores de los estados del flujo */
export const ARTE_ESTADO_LABELS: Record<ArteEstado, { label: string; color: string }> = {
  EN_CURSO: {
    label: 'En firmas',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  },
  DEVUELTO_DISENO: {
    label: 'Devuelto a Diseño',
    color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-400',
  },
  APROBADO: {
    label: 'Aprobado',
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
  },
  CANCELADO: {
    label: 'Cancelado',
    color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
  },
};

export const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
