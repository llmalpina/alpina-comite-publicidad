import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

// Usuarios de prueba para acceso rápido (solo dev)
const DEV_USERS: Record<UserRole, User> = {
  SOLICITANTE:   { id: 'dev-u1', name: 'Carlos Rodríguez', email: 'carlos.rodriguez@alpina.com', role: 'SOLICITANTE', area: 'Mercadeo - Bon Yurt' },
  REVISOR_ARA:   { id: 'dev-u2', name: 'Ana María López',  email: 'ana.lopez@alpina.com',        role: 'REVISOR_ARA',   area: 'Asuntos Regulatorios' },
  REVISOR_LEGAL: { id: 'dev-u3', name: 'Juan Felipe Gómez',email: 'juan.gomez@alpina.com',       role: 'REVISOR_LEGAL', area: 'Legal' },
  ADMIN:         { id: 'dev-u4', name: 'Marta Lucía Casas',email: 'marta.casas@alpina.com',      role: 'ADMIN',         area: 'Coordinación Comité' },
};

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';
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

/** Llama al endpoint de Cognito USER_PASSWORD_AUTH */
async function cognitoAuth(email: string, password: string) {
  const url = `https://cognito-idp.${REGION}.amazonaws.com/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Credenciales incorrectas');
  }
  return res.json();
}

/** Refresca el token usando el refresh token */
async function cognitoRefresh(refreshToken: string) {
  const url = `https://cognito-idp.${REGION}.amazonaws.com/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }),
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
            // Limpia el token de la URL sin recargar
            window.history.replaceState({}, '', window.location.pathname);
            setLoading(false);
            return;
          }
        } catch { /* token inválido, continúa con flujo normal */ }
      }

      // Sesión dev guardada
      const devUser = localStorage.getItem('alpina_dev_user');
      if (devUser) { setUser(JSON.parse(devUser)); setLoading(false); return; }

      const idToken = localStorage.getItem('alpina_id_token');
      const refreshToken = localStorage.getItem('alpina_refresh_token');
      if (!idToken || !refreshToken) { setLoading(false); return; }

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
      } catch {
        localStorage.clear();
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const login = async (email: string, password: string): Promise<{ challenge?: string; session?: string }> => {
    const data = await cognitoAuth(email, password);
    if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return { challenge: 'NEW_PASSWORD_REQUIRED', session: data.Session };
    }
    const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
    localStorage.setItem('alpina_id_token', IdToken);
    localStorage.setItem('alpina_access_token', AccessToken);
    localStorage.setItem('alpina_refresh_token', RefreshToken);
    const baseUser = buildUserFromToken(IdToken);
    const enriched = await enrichUserFromDB(baseUser);
    setUser(enriched);
    return {};
  };

  /** Completa el challenge NEW_PASSWORD_REQUIRED */
  const completeNewPassword = async (email: string, newPassword: string, session: string) => {
    const url = `https://cognito-idp.${REGION}.amazonaws.com/`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
      },
      body: JSON.stringify({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: CLIENT_ID,
        ChallengeResponses: { USERNAME: email, NEW_PASSWORD: newPassword },
        Session: session,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al cambiar contraseña');
    }
    const data = await res.json();
    const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
    localStorage.setItem('alpina_id_token', IdToken);
    localStorage.setItem('alpina_access_token', AccessToken);
    localStorage.setItem('alpina_refresh_token', RefreshToken);
    // Después del cambio de contraseña el token puede no traer custom:role — enriquecemos desde DB
    const baseUser = buildUserFromToken(IdToken);
    const enriched = await enrichUserFromDB(baseUser);
    setUser(enriched);
  };

  const logout = () => {
    localStorage.removeItem('alpina_id_token');
    localStorage.removeItem('alpina_access_token');
    localStorage.removeItem('alpina_refresh_token');
    localStorage.removeItem('alpina_dev_user');
    setUser(null);
  };

  /** Acceso rápido para desarrollo — no requiere Cognito */
  const loginDev = (role: UserRole) => {
    const devUser = DEV_USERS[role];
    localStorage.setItem('alpina_dev_user', JSON.stringify(devUser));
    setUser(devUser);
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
