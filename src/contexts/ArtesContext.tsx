import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { artesApi } from '../lib/artes-api';
import { useAuth } from './AuthContext';
import { useConfig } from './ConfigContext';
import type { ArtesConfig, ArteTeam } from '../types/artes';

/**
 * Configuración y accesos del módulo de aprobación de artes por equipos.
 *
 * El acceso a las secciones se resuelve por dos vías, combinadas:
 *  1. Permisos del rol (matriz configurable en Configuración > Roles)
 *  2. Pertenencia a un equipo (por correo), sin necesidad de cambiar el rol
 */

const DEFAULT_CONFIG: ArtesConfig = {
  enabled: true,
  contentTypes: ['PAQUETE_ARTES'],
  startOnStatuses: ['APROBADA', 'APROBADA_OBSERVACIONES'],
  onRejectRestart: 'REJECTING',
  anyMemberCanSign: false,
  ccEmails: [],
  routes: [],
  teams: [
    { id: 'EMPAQUES',   label: 'Empaques',   order: 1,  activo: true, isDesign: false, color: 'bg-blue-100 text-blue-700',       members: [] },
    { id: 'MERCADEO',   label: 'Mercadeo',   order: 2,  activo: true, isDesign: false, color: 'bg-purple-100 text-purple-700',   members: [] },
    { id: 'INOCUIDAD',  label: 'Inocuidad',  order: 3,  activo: true, isDesign: false, color: 'bg-emerald-100 text-emerald-700', members: [] },
    { id: 'DESARROLLO', label: 'Desarrollo', order: 4,  activo: true, isDesign: false, color: 'bg-amber-100 text-amber-700',     members: [] },
    { id: 'DISENO',     label: 'Diseño',     order: 99, activo: true, isDesign: true,  color: 'bg-pink-100 text-pink-700',       members: [] },
  ],
  reminder: { enabled: true, day: 1, hour: 8, minute: 0, timezoneOffset: -5, ccEmails: [] },
};

interface ArtesContextType {
  config: ArtesConfig;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveConfig: (config: ArtesConfig) => Promise<void>;
  /** Equipos del usuario actual, resueltos por su correo */
  myTeams: ArteTeam[];
  /** Equipos que firman, en orden */
  approvalTeams: ArteTeam[];
  designTeam: ArteTeam | null;
  /** Administra todo el flujo (ve y opera sobre cualquier pieza) */
  isArtesAdmin: boolean;
  /** Puede ver la cola de aprobación */
  canVerCola: boolean;
  /** Puede firmar en nombre de su equipo */
  canAprobar: boolean;
  /** Puede subir ajustes del arte (Diseño) */
  canSubirAjuste: boolean;
  /** Puede ver el repositorio de aprobados */
  canVerRepositorio: boolean;
  /** Puede configurar equipos y recordatorios */
  canGestionarEquipos: boolean;
}

const ArtesContext = createContext<ArtesContextType | undefined>(undefined);

/** Ordena y normaliza lo que llega del backend para que la UI sea predecible */
function normalize(raw: Partial<ArtesConfig> | null): ArtesConfig {
  const cfg = { ...DEFAULT_CONFIG, ...(raw || {}) } as ArtesConfig;
  cfg.teams = (Array.isArray(raw?.teams) && raw!.teams.length ? raw!.teams : DEFAULT_CONFIG.teams)
    .map((t, i) => ({
      ...t,
      order: typeof t.order === 'number' ? t.order : i + 1,
      activo: t.activo !== false,
      isDesign: t.isDesign === true,
      members: Array.isArray(t.members) ? t.members : [],
      color: t.color || 'bg-slate-100 text-slate-700',
    }))
    .sort((a, b) => a.order - b.order);
  cfg.reminder = { ...DEFAULT_CONFIG.reminder, ...(raw?.reminder || {}) };
  cfg.ccEmails = Array.isArray(cfg.ccEmails) ? cfg.ccEmails : [];
  cfg.routes = Array.isArray(cfg.routes) ? cfg.routes : [];
  cfg.contentTypes = Array.isArray(cfg.contentTypes) && cfg.contentTypes.length
    ? cfg.contentTypes : DEFAULT_CONFIG.contentTypes;
  cfg.startOnStatuses = Array.isArray(cfg.startOnStatuses) && cfg.startOnStatuses.length
    ? cfg.startOnStatuses : DEFAULT_CONFIG.startOnStatuses;
  return cfg;
}

export const ArtesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = useConfig();
  const [config, setConfig] = useState<ArtesConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await artesApi.getConfig();
      setConfig(normalize(remote));
    } catch (e: any) {
      // Si el backend no responde se usan los defaults para no bloquear la UI
      setError(e?.message || 'No se pudo cargar la configuración de artes');
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  // Solo se consulta con sesión activa: en el login no hace falta
  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    reload();
  }, [isAuthenticated, reload]);

  const saveConfig = useCallback(async (next: ArtesConfig) => {
    const saved = await artesApi.saveConfig(next);
    setConfig(normalize(saved));
  }, []);

  const email = (user?.email || '').trim().toLowerCase();
  const myTeams = config.teams.filter(t => t.members.some(m => (m.email || '').trim().toLowerCase() === email));
  const approvalTeams = config.teams.filter(t => t.activo && !t.isDesign).sort((a, b) => a.order - b.order);
  const designTeam = config.teams.find(t => t.isDesign && t.activo) || null;

  const role = user?.role || '';
  const isArtesAdmin = role === 'ADMIN' || hasPermission(role, 'artes_admin_flujo');
  const enEquipo = myTeams.length > 0;
  const esDiseno = !!designTeam && myTeams.some(t => t.id === designTeam.id);

  const value: ArtesContextType = {
    config,
    loading,
    error,
    reload,
    saveConfig,
    myTeams,
    approvalTeams,
    designTeam,
    isArtesAdmin,
    // Pertenecer a un equipo ya da acceso a la cola y al repositorio;
    // los permisos del rol sirven para dar acceso a quien no está en un equipo.
    canVerCola: isArtesAdmin || enEquipo || hasPermission(role, 'artes_ver_cola'),
    canAprobar: isArtesAdmin || (enEquipo && hasPermission(role, 'artes_aprobar')),
    canSubirAjuste: isArtesAdmin || esDiseno || hasPermission(role, 'artes_subir_ajuste'),
    canVerRepositorio: isArtesAdmin || enEquipo || hasPermission(role, 'artes_ver_repositorio'),
    canGestionarEquipos: isArtesAdmin || hasPermission(role, 'artes_gestionar_equipos'),
  };

  return <ArtesContext.Provider value={value}>{children}</ArtesContext.Provider>;
};

export const useArtes = () => {
  const ctx = useContext(ArtesContext);
  if (!ctx) throw new Error('useArtes debe usarse dentro de ArtesProvider');
  return ctx;
};
