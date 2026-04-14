import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { BrowserRouter } from 'react-router-dom';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <img src="/assets/Logo_azul_oscuro_alpina.png" alt="Alpina" className="w-12 h-12 animate-pulse" />
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

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/solicitudes" element={<ProtectedRoute roles={['SOLICITANTE','ADMIN']}><SolicitudesPage /></ProtectedRoute>} />
    <Route path="/solicitudes/nueva" element={<ProtectedRoute roles={['SOLICITANTE','ADMIN']}><NuevaSolicitudPage /></ProtectedRoute>} />
    <Route path="/solicitudes/:id" element={<ProtectedRoute><SolicitudDetailPage /></ProtectedRoute>} />
    <Route path="/revision" element={<ProtectedRoute roles={['REVISOR_ARA','REVISOR_LEGAL','ADMIN']}><RevisionQueuePage /></ProtectedRoute>} />
    <Route path="/revision/:id" element={<ProtectedRoute roles={['REVISOR_ARA','REVISOR_LEGAL','ADMIN']}><RevisionDetailPage /></ProtectedRoute>} />
    <Route path="/admin/reportes" element={<ProtectedRoute roles={['ADMIN']}><ReportsPage /></ProtectedRoute>} />
    <Route path="/admin/maestros" element={<ProtectedRoute roles={['ADMIN']}><MaestrosPage /></ProtectedRoute>} />
    <Route path="/admin/usuarios" element={<ProtectedRoute roles={['ADMIN']}><UsuariosPage /></ProtectedRoute>} />
    <Route path="/admin/configuracion" element={<ProtectedRoute roles={['ADMIN']}><ConfiguracionPage /></ProtectedRoute>} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <MaestrosProvider>
            <ConfigProvider>
              <NotificationProvider>
                <AppRoutes />
              </NotificationProvider>
            </ConfigProvider>
          </MaestrosProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
