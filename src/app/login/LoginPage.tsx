import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login, completeNewPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Deep link: si el usuario viene redirigido de una página protegida, guardar la ruta destino
  const redirectTo = (location.state as any)?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado para cambio de contraseña obligatorio
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [cognitoSession, setCognitoSession] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Ingresa tu correo y contraseña'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await login(email.trim(), password);
      if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
        // Cognito pide cambio de contraseña en primer ingreso
        setCognitoSession(result.session || '');
        setNeedsNewPassword(true);
      } else {
        navigate(redirectTo);
      }
    } catch (err: any) {
      const msg = err.message || 'Error al iniciar sesión';
      // Traducir errores comunes de Cognito
      if (msg.toLowerCase().includes('temporary password has expired')) {
        setError('Tu contraseña temporal ha expirado. Contacta al administrador para que te asigne una nueva.');
      } else if (msg.toLowerCase().includes('incorrect username or password') || msg.toLowerCase().includes('user does not exist')) {
        setError('Correo o contraseña incorrectos.');
      } else if (msg.toLowerCase().includes('user is disabled')) {
        setError('Tu cuenta está desactivada. Contacta al administrador.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    setError('');
    try {
      await completeNewPassword(email.trim(), newPassword, cognitoSession);
      navigate(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-brand-800 dark:bg-slate-950">
      {/* Panel izquierdo */}
      <div className="md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-brand rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-brand-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <img src="/assets/Logo_azul_alpina.png" alt="Alpina" className="w-32 md:w-44 mb-8 drop-shadow-lg" />
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">Comité Autorregulación Publicitaria</h1>
          <p className="text-brand-200 text-sm max-w-xs">Plataforma de revisión y aprobación de piezas publicitarias</p>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white dark:bg-slate-900 md:rounded-l-[3rem]">
        <div className="w-full max-w-sm">

          {/* Formulario cambio de contraseña */}
          {needsNewPassword ? (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">🔐</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Cambia tu contraseña</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Es tu primer ingreso. Crea una contraseña nueva y segura para continuar.
                </p>
              </div>
              <form onSubmit={handleNewPassword} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Repite la contraseña"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-600 transition-colors shadow-lg shadow-brand/20 disabled:opacity-60"
                >
                  {loading ? 'Guardando...' : 'Establecer contraseña e ingresar'}
                </button>
              </form>
            </>
          ) : (
            /* Formulario login normal */
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Bienvenido</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Ingresa tus credenciales corporativas para continuar</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Correo corporativo</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="nombre@alpina.com"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                    autoComplete="current-password"
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-600 transition-colors shadow-lg shadow-brand/20 disabled:opacity-60"
                >
                  {loading ? 'Verificando...' : 'Iniciar Sesión'}
                </button>
              </form>
            </>
          )}

          <p className="text-[10px] text-slate-400 text-center mt-8">© 2025 Alpina — Comité Autorregulación Publicitaria</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
