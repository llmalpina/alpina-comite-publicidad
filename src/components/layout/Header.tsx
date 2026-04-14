import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ROLE_LABELS } from '../../lib/constants';

interface HeaderProps {
  onMenuToggle: () => void;
}

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  ADMIN:         { bg: '#300249', fg: '#fff' },
  REVISOR_ARA:   { bg: '#1450C9', fg: '#fff' },
  REVISOR_LEGAL: { bg: '#65C5E9', fg: '#1e293b' },
  SOLICITANTE:   { bg: '#99DCF1', fg: '#1e293b' },
};

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const { dark, toggleDark } = useTheme();
  const rolStyle = user ? ROLE_COLORS[user.role] : null;

  return (
    <header className="h-14 shrink-0 bg-brand-800 dark:bg-slate-950 border-b border-brand-700 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 z-40 shadow-sm">
      <div className="flex items-center gap-2">
        <button onClick={onMenuToggle} className="p-2 rounded-lg text-brand-100 hover:bg-brand-700 md:hidden" aria-label="Abrir menú">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button onClick={() => window.location.href = '/dashboard'} className="flex items-center gap-3 hover:opacity-80 transition-opacity" aria-label="Ir al inicio">
          <img src="/assets/logo-alpina.png" alt="" className="h-8" />
          <span className="hidden sm:block font-bold text-white text-sm">Comité de Publicidad</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggleDark} className="p-2 rounded-lg text-brand-100 hover:bg-brand-700 dark:hover:bg-slate-800 transition-colors" title={dark ? 'Modo claro' : 'Modo oscuro'}>
          {dark ? '☀️' : '🌙'}
        </button>

        <button className="relative p-2 rounded-lg text-brand-100 hover:bg-brand-700 dark:hover:bg-slate-800 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-brand-800 dark:border-slate-950"></span>
        </button>

        <div className="flex items-center gap-2 bg-brand-700 dark:bg-slate-800 border border-brand-600 dark:border-slate-700 rounded-lg px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
            {user?.name.charAt(0)}
          </div>
          <span className="text-sm text-brand-50 font-medium hidden sm:block">{user?.name}</span>
          {rolStyle && (
            <span className="hidden sm:block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: rolStyle.bg, color: rolStyle.fg }}>
              {ROLE_LABELS[user!.role]}
            </span>
          )}
        </div>

        <button onClick={() => { logout(); window.location.href = '/login'; }} className="flex items-center gap-1.5 text-xs text-brand-100 hover:text-red-300 border border-brand-600 dark:border-slate-700 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors" title="Cerrar sesión">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span className="hidden sm:block">Salir</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
