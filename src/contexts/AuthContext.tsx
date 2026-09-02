import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

/**
 * Cierre de sesión por inactividad.
 *
 * El refresh token de Cognito dura 30 días y se guarda en localStorage, así que
 * sin este control un usuario que abra la app una vez queda logeado durante 30
 * días sin volver a pedir credenciales (riesgo de seguridad en equipos
 * compartidos o si se pierde el dispositivo). Aquí se registra la última
 * actividad real del usuario (clic, tecla, scroll, touch) y si pasa el umbral
 * sin actividad, se cierra la sesión aunque el refresh token siga siendo válido.
 */
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos sin actividad
const LAST_ACTIVITY_KEY = 'alpina_last_activity';

function markActivity() {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* localStorage no disponible */ }
}

function isSessionExpiredByInactivity(): boolean {
  try {
    const last = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!last) return false; // primera carga: no hay historial de inactividad aún
    return Date.now() - Number(last) > INACTIVITY_LIMIT_MS;
  } catch {
    return false;
  }
}

// Usuarios de prueba para acceso rápido (solo dev)
const DEV_USERS: Record<UserRole, User> = {
  SOLICITANTE:   { id: 'dev-u1', name: 'Carlos Rodríguez', email: 'carlos.rodriguez@alpina.com', role: 'SOLICITANTE', area: 'Mercadeo - Bon Yurt' },
  REVISOR_ARA:   { id: 'dev-u2', name: 'Ana María López',  email: 'ana.lopez@alpina.com',        role: 'REVISOR_ARA',   area: 'Asuntos Regulatorios' },
  REVISOR_LEGAL: { id: 'dev-u3', name: 'Juan Felipe Gómez',email: 'juan.gomez@alpina.com',       role: 'REVISOR_LEGAL', area: 'Legal' },
  REVISOR_BOYDORR: { id: 'dev-u5', name: 'Revisor Boydorr', email: 'revisor.boydorr@alpina.com', role: 'REVISOR_BOYDORR', area: 'Nutrición' },
  ADMIN:         { id: 'dev-u4', name: 'Marta Lucía Casas',email: 'marta.casas@alpina.com',      role: 'ADMIN',         area: 'Coordinación Comité' },
};

const API_URL = import.meta.env.VITE_API_URL as string;

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ challenge?: string; session?: string }>;
  completeNewPassword: (email: string, newPassword: string, session: string) => Promise<void>;
  loginDev: (role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Decodifica el payload de un JWT sin verificar firma (solo frontend) */
function decodeJwt(token: string): Record<string, any> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

/** Llama al endpoint /auth del API Gateway en lugar de Cognito directamente (CORS safe) */
async function cognitoAuth(email: string, password: string) {
  const url = `${API_URL}/auth`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, action: 'login' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Credenciales incorrectas');
  }
  return res.json();
}

/** Completa el challenge NEW_PASSWORD_REQUIRED a través del API Gateway */
async function cognitoCompleteNewPassword(email: string, newPassword: string, session: string) {
  const url = `${API_URL}/auth`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword, session, action: 'complete-new-password' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Error al cambiar contraseña');
  }
  return res.json();
}

/** Refresca el token usando el refresh token a través del API Gateway */
async function cognitoRefresh(refreshToken: string) {
  const url = `${API_URL}/auth`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, action: 'refresh' }),
  });
  if (!res.ok) throw new Error('Sesión expirada');
  return res.json();
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /** Construye el objeto User a partir del ID token de Cognito */
  const buildUserFromToken = (idToken: string): User => {
    const claims = decodeJwt(idToken);
    return {
      id: claims['sub'],
      name: claims['name'] || claims['cognito:username'] || claims['email'],
      email: claims['email'],
      role: (claims['custom:role'] as UserRole) || 'SOLICITANTE',
      area: claims['custom:area'] || '',
      avatar: claims['picture'],
    };
  };

  /**
   * Enriquece el usuario con el rol desde DynamoDB.
   * Siempre consulta cuando hay API configurada para garantizar el rol correcto.
   */
  const enrichUserFromDB = async (baseUser: User): Promise<User> => {
    if (!API_URL) return baseUser;
    try {
      const token = localStorage.getItem('alpina_id_token');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000); // 2s timeout
      const res = await fetch(`${API_URL}/usuarios`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return baseUser;
      const users: any[] = await res.json();
      const found = users.find(u => u.email === baseUser.email);
      if (found?.role) return { ...baseUser, role: found.role as UserRole, area: found.area || baseUser.area };
    } catch { /* timeout o error — usa el rol del token */ }
    return baseUser;
  };

  /** Al iniciar, intenta restaurar sesión desde localStorage o token SSO en URL */
  useEffect(() => {
    const restore = async () => {
      // SSO desde Data Hub: ?sso=<idToken>
      const params = new URLSearchParams(window.location.search);
      const ssoToken = params.get('sso');
      if (ssoToken) {
        try {
          const claims = decodeJwt(ssoToken);
          const now = Math.floor(Date.now() / 1000);
          if (claims.exp && claims.exp > now) {
            localStorage.setItem('alpina_id_token', ssoToken);
            setUser(buildUserFromToken(ssoToken));
            markActivity();
            // Limpia el token de la URL sin recargar
            window.history.replaceState({}, '', window.location.pathname);
            setLoading(false);
            return;
          }
        } catch { /* token inválido, continúa con flujo normal */ }
      }

      // Sesión dev guardada (deshabilitado en producción)
      // const devUser = localStorage.getItem('alpina_dev_user');
      // if (devUser) { setUser(JSON.parse(devUser)); setLoading(false); return; }

      const idToken = localStorage.getItem('alpina_id_token');
      const refreshToken = localStorage.getItem('alpina_refresh_token');
      if (!idToken || !refreshToken) { setLoading(false); return; }

      // Sesión inactiva por más de 30 minutos: cerrar sesión aunque el refresh
      // token de Cognito (30 días) siga siendo técnicamente válido.
      if (isSessionExpiredByInactivity()) {
        localStorage.clear();
        setLoading(false);
        return;
      }
      markActivity();

      // Verifica si el token está expirado
      const claims = decodeJwt(idToken);
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp && claims.exp > now) {
        const baseUser = buildUserFromToken(idToken);
        const enriched = await enrichUserFromDB(baseUser);
        setUser(enriched);
        setLoading(false);
        return;
      }

      // Token expirado — intenta refrescar
      try {
        const data = await cognitoRefresh(refreshToken);
        const newIdToken = data.AuthenticationResult.IdToken;
        localStorage.setItem('alpina_id_token', newIdToken);
        const baseUser = buildUserFromToken(newIdToken);
        const enriched = await enrichUserFromDB(baseUser);
        setUser(enriched);
        markActivity();
      } catch {
        localStorage.clear();
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  // Mientras haya sesión: registra actividad real del usuario y revisa cada
  // minuto si se superó el límite de inactividad para cerrar sesión sola.
  useEffect(() => {
    if (!user) return;
    markActivity();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const onActivity = () => markActivity();
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));

    const interval = setInterval(() => {
      if (isSessionExpiredByInactivity()) {
        localStorage.clear();
        setUser(null);
        // Recarga completa al login: limpia cualquier estado en memoria de la SPA
        window.location.href = `${(import.meta as any).env?.BASE_URL || '/'}login`;
      }
    }, 60 * 1000);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, onActivity));
      clearInterval(interval);
    };
  }, [user]);

  const login = async (email: string, password: string): Promise<{ challenge?: string; session?: string }> => {
    const data = await cognitoAuth(email, password);
    if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return { challenge: 'NEW_PASSWORD_REQUIRED', session: data.Session };
    }
    // Cualquier otro challenge (MFA, etc.) no está soportado en esta pantalla.
    if (data.ChallengeName) {
      throw new Error('Tu cuenta requiere un paso adicional de verificación no disponible aquí. Contacta al administrador.');
    }
    // Si Cognito no devolvió tokens, no intentamos desestructurar (evita el error
    // "Cannot destructure property 'IdToken'"). Damos un mensaje entendible.
    if (!data.AuthenticationResult?.IdToken) {
      throw new Error('No se pudo iniciar sesión. Intenta de nuevo; si persiste, contacta al administrador.');
    }
    const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
    localStorage.setItem('alpina_id_token', IdToken);
    localStorage.setItem('alpina_access_token', AccessToken);
    localStorage.setItem('alpina_refresh_token', RefreshToken);
    const baseUser = buildUserFromToken(IdToken);
    const enriched = await enrichUserFromDB(baseUser);
    setUser(enriched);
    markActivity();
    return {};
  };

  /** Completa el challenge NEW_PASSWORD_REQUIRED */
  const completeNewPassword = async (email: string, newPassword: string, session: string) => {
    const data = await cognitoCompleteNewPassword(email, newPassword, session);
    if (!data.AuthenticationResult?.IdToken) {
      throw new Error('No se pudo establecer la contraseña. Solicita al administrador una nueva contraseña temporal e intenta otra vez.');
    }
    const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
    localStorage.setItem('alpina_id_token', IdToken);
    localStorage.setItem('alpina_access_token', AccessToken);
    localStorage.setItem('alpina_refresh_token', RefreshToken);
    const baseUser = buildUserFromToken(IdToken);
    const enriched = await enrichUserFromDB(baseUser);
    setUser(enriched);
    markActivity();
  };

  const logout = () => {
    localStorage.removeItem('alpina_id_token');
    localStorage.removeItem('alpina_access_token');
    localStorage.removeItem('alpina_refresh_token');
    localStorage.removeItem('alpina_dev_user');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setUser(null);
  };

  /** Acceso rápido para desarrollo — no requiere Cognito */
  const loginDev = (role: UserRole) => {
    const devUser = DEV_USERS[role];
    localStorage.setItem('alpina_dev_user', JSON.stringify(devUser));
    setUser(devUser);
    markActivity();
  };

  return (
    <AuthContext.Provider value={{ user, login, completeNewPassword, loginDev, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
