export type UserRole = 'SOLICITANTE' | 'REVISOR_ARA' | 'REVISOR_LEGAL' | 'ADMIN';

export type RequestStatus = 
  | 'BORRADOR' 
  | 'ENVIADA' 
  | 'PREVALIDACION_IA' 
  | 'EN_REVISION' 
  | 'CONSOLIDACION' 
  | 'APROBADA' 
  | 'APROBADA_OBSERVACIONES'
  | 'RECHAZADA'
  | 'PUBLICADA';

export type ContentType = 
  | 'PARRILLA_DIGITAL'
  | 'PARRILLA_MARCAS'
  | 'GUIONES_CREADORES'
  | 'MALLA_OOH'
  | 'PAQUETE_ARTES'
  | 'GUIONES_TV'
  | 'MATRIZ_COPYS'
  | 'QA_CAMPANAS'
  | 'LANDING_WEB_EMAIL'
  | 'PAQUETE_POP'
  | 'COMUNICADOS_PRENSA';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  area?: string;
  avatar?: string;
}

export interface FileAsset {
  id: string;
  name: string;
  type: 'pdf';
  url: string;
  s3Key?: string;
  size: number;
  uploadedAt: string;
  version: number;
}

export interface DocumentVersion {
  id: string;
  solicitudId: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  version: number;
  userId: string;
  userName: string;
  uploadedAt: string;
  active: boolean;
  changeNote?: string;
}

export interface IAObservation {
  id: string;
  category: 'LEGAL' | 'NUTRICIONAL' | 'MARCA' | 'REDACCION';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  ruleReference?: string;
  suggestion?: string;
}

export interface IAResult {
  score: number;
  observations: IAObservation[];
}

/** Comentario general tipo blog dentro de una solicitud */
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  text: string;
  createdAt: string;
  area?: string;
}

/** Tipo de herramienta de anotación */
export type AnnotationTool = 'select' | 'hand' | 'pin' | 'rect' | 'underline' | 'strikethrough' | 'arrow' | 'freehand';

/** Anotación sobre el PDF: referencia a página y posición */
export interface PdfAnnotation {
  id: string;
  solicitudId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  text: string;
  page: number;       // página del PDF (1-indexed)
  x: number;          // posición relativa 0-100
  y: number;          // posición relativa 0-100
  /** Tipo de anotación */
  tool?: AnnotationTool;
  /** Para rect/underline/strikethrough/arrow: punto final */
  x2?: number;
  y2?: number;
  /** Color de la anotación */
  color?: string;
  createdAt: string;
  area?: string;
  version?: number;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  /** Puntos para freehand */
  points?: { x: number; y: number }[];
}

export interface Solicitud {
  id: string;
  consecutive: string;
  title: string;
  description: string;
  brand: string;
  product: string;
  contentType: ContentType;
  channel: string;
  status: RequestStatus;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  solicitanteId: string;
  solicitanteName: string;
  area: string;
  files: FileAsset[];
  iaResult?: IAResult;
  comments: Comment[];
  annotations: PdfAnnotation[];
  currentVersion: number;
  versions: DocumentVersion[];
  /** Aprobación de ARA */
  approvalARA?: { approved: boolean; by: string; at: string; nota?: string };
  /** Aprobación de Legal */
  approvalLegal?: { approved: boolean; by: string; at: string; nota?: string };
}

export interface AreaBudget {
  area: string;
  totalHours: number;
  consumedHours: number;
}

// ---- Maestros parametrizables ----
export interface MaestroItem {
  id: string;
  label: string;
  value: string;
  activo: boolean;
  /** Minutos de revisión por pieza (solo para tiposContenido) */
  minutos?: number;
  /** Contenidos aproximados por semana (solo para tiposContenido) */
  contenidosSemana?: number;
}

export interface MaestrosConfig {
  marcas: MaestroItem[];
  areas: MaestroItem[];
  canales: MaestroItem[];
  tiposContenido: MaestroItem[];
  promptIA: string;
}
