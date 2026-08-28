import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getAssetPath } from './lib/constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MaestrosProvider } from './contexts/MaestrosContext';
import { ConfigProvider } from './contexts/ConfigContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import LoginPage from './app/login/LoginPage';
import DashboardPage from './app/dashboard/DashboardPage';
import SolicitudesPage from './app/solicitudes/SolicitudesListPage';
import NuevaSolicitudPage from './app/solicitudes/nueva/NuevaSolicitudPage';
import SolicitudDetailPage from './app/solicitudes/[id]/SolicitudDetailPage';
import RevisionQueuePage from './app/revision/RevisionQueuePage';
import RevisionDetailPage from './app/revision/[id]/RevisionDetailPage';
import ReportsPage from './app/admin/reportes/ReportsPage';
import MaestrosPage from './app/admin/maestros/MaestrosPage';
import UsuariosPage from './app/admin/usuarios/UsuariosPage';
import ConfiguracionPage from './app/admin/configuracion/ConfiguracionPage';
import ManualPage from './app/manual/ManualPage';
import { ArtesProvider, useArtes } from './contexts/ArtesContext';
import ArtesColaPage from './app/artes/cola/ArtesColaPage';
import ArtesAprobadosPage from './app/artes/aprobados/ArtesAprobadosPage';
import ArtesEquiposPage from './app/artes/equipos/ArtesEquiposPage';
import ArteDetailPage from './app/artes/[id]/ArteDetailPage';
import { BrowserRouter } from 'react-router-dom';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <img src={getAssetPath('Logo_azul_oscuro_alpina.png')} alt="Alpina" className="w-12 h-12 animate-pulse" />
        <p className="text-sm text-slate-400">Verificando sesión...</p>
      </div>
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-900 dark:text-slate-100">
      <Header onMenuToggle={() => setMobileMenuOpen(v => !v)} />
      <div className="flex flex-1 overflow-hidden">
        {mobileMenuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />}
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <main className="flex-1 overflow-y-auto bg-brand-50 dark:bg-slate-900">
          <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

/**
 * Acceso al módulo de artes.
 * A diferencia del comité, aquí el acceso no depende solo del rol: pertenecer a
 * un equipo (por correo) ya habilita la cola y el repositorio.
 */
const ArtesRoute: React.FC<{ children: React.ReactNode; need: 'cola' | 'repositorio' | 'config' }> = ({ children, need }) => {
  const { loading, canVerCola, canVerRepositorio, canGestionarEquipos } = useArtes();

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-sm text-slate-400">Verificando acceso...</div>
  );

  const permitido = need === 'config' ? canGestionarEquipos
    : need === 'repositorio' ? canVerRepositorio
    : canVerCola;

  if (!permitido) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/solicitudes" element={<ProtectedRoute roles={['SOLICITANTE','ADMIN']}><SolicitudesPage /></ProtectedRoute>} />
    <Route path="/solicitudes/nueva" element={<ProtectedRoute roles={['SOLICITANTE','ADMIN']}><NuevaSolicitudPage /></ProtectedRoute>} />
    <Route path="/solicitudes/:id" element={<ProtectedRoute><SolicitudDetailPage /></ProtectedRoute>} />
    <Route path="/revision" element={<ProtectedRoute roles={['REVISOR_ARA','REVISOR_LEGAL','REVISOR_BOYDORR','ADMIN']}><RevisionQueuePage /></ProtectedRoute>} />
    <Route path="/revision/:id" element={<ProtectedRoute roles={['REVISOR_ARA','REVISOR_LEGAL','REVISOR_BOYDORR','ADMIN']}><RevisionDetailPage /></ProtectedRoute>} />
    <Route path="/admin/reportes" element={<ProtectedRoute roles={['ADMIN']}><ReportsPage /></ProtectedRoute>} />
    <Route path="/admin/maestros" element={<ProtectedRoute roles={['ADMIN']}><MaestrosPage /></ProtectedRoute>} />
    <Route path="/admin/usuarios" element={<ProtectedRoute roles={['ADMIN']}><UsuariosPage /></ProtectedRoute>} />
    <Route path="/admin/configuracion" element={<ProtectedRoute roles={['ADMIN']}><ConfiguracionPage /></ProtectedRoute>} />
    {/* Flujo de aprobación de artes por equipos (módulo independiente) */}
    <Route path="/artes/cola" element={<ProtectedRoute><ArtesRoute need="cola"><ArtesColaPage /></ArtesRoute></ProtectedRoute>} />
    <Route path="/artes/aprobados" element={<ProtectedRoute><ArtesRoute need="repositorio"><ArtesAprobadosPage /></ArtesRoute></ProtectedRoute>} />
    <Route path="/artes/equipos" element={<ProtectedRoute><ArtesRoute need="config"><ArtesEquiposPage /></ArtesRoute></ProtectedRoute>} />
    <Route path="/artes/:id" element={<ProtectedRoute><ArtesRoute need="cola"><ArteDetailPage /></ArtesRoute></ProtectedRoute>} />
    <Route path="/manual" element={<ProtectedRoute><ManualPage /></ProtectedRoute>} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter basename="/comite-publicidad">
      <ThemeProvider>
        <AuthProvider>
          <MaestrosProvider>
            <ConfigProvider>
              <ArtesProvider>
                <NotificationProvider>
                  <AppRoutes />
                </NotificationProvider>
              </ArtesProvider>
            </ConfigProvider>
          </MaestrosProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
