import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAssetPath } from '../../lib/constants';

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
    // Política de contraseña de Cognito: 8+, mayúscula, minúscula, número y símbolo.
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (!/[A-Z]/.test(newPassword)) { setError('La contraseña debe incluir al menos una mayúscula'); return; }
    if (!/[a-z]/.test(newPassword)) { setError('La contraseña debe incluir al menos una minúscula'); return; }
    if (!/[0-9]/.test(newPassword)) { setError('La contraseña debe incluir al menos un número'); return; }
    if (!/[^A-Za-z0-9]/.test(newPassword)) { setError('La contraseña debe incluir al menos un símbolo (ej: ! @ # $)'); return; }
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    setError('');
    try {
      await completeNewPassword(email.trim(), newPassword, cognitoSession);
      navigate(redirectTo);
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      // Si la sesión del challenge ya se consumió/venció, hay que reiniciar el login.
      if (msg.includes('session') || msg.includes('sesión') || msg.includes('used once') || msg.includes('not authorized') || msg.includes('no se pudo establecer')) {
        setNeedsNewPassword(false);
        setCognitoSession('');
        setNewPassword('');
        setConfirmPassword('');
        setPassword('');
        setError('La sesión expiró. Vuelve a iniciar sesión con tu contraseña temporal para intentarlo de nuevo.');
      } else if (msg.includes('policy')) {
        setError('La contraseña no cumple la política: mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.');
      } else {
        setError(err.message || 'Error al cambiar la contraseña');
      }
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
          <img src={getAssetPath('APPrueba-logo.png')} alt="Alpina" className="w-52 md:w-72 mb-8 drop-shadow-lg" />
          <p className="text-brand-200 text-sm max-w-xs"> Plataforma de gestión y autorregulación de piezas publicitarias!</p>
        </div>
      </div>t

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
                  <p className="text-[11px] text-slate-400 mt-1.5">Debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y símbolo (ej: ! @ # $).</p>
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
                <button
                  type="button"
                  onClick={() => {
                    setNeedsNewPassword(false);
                    setCognitoSession('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPassword('');
                    setError('');
                  }}
                  className="w-full text-slate-500 dark:text-slate-400 text-xs font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  ← Volver al inicio de sesión
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
