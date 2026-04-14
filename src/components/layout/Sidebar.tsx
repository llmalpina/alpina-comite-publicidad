import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, FileText, CheckSquare, Settings, BarChart3, Users, PlusCircle, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const NAV_GROUPS = [
  { label: 'Principal', items: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['SOLICITANTE','REVISOR_ARA','REVISOR_LEGAL','ADMIN'] },
  ]},
  { label: 'Solicitudes', items: [
    { label: 'Mis Solicitudes', icon: FileText, path: '/solicitudes', roles: ['SOLICITANTE'] },
    { label: 'Nueva Solicitud', icon: PlusCircle, path: '/solicitudes/nueva', roles: ['SOLICITANTE'] },
  ]},
  { label: 'Revisión', items: [
    { label: 'Cola de Revisión', icon: CheckSquare, path: '/revision', roles: ['REVISOR_ARA','REVISOR_LEGAL','ADMIN'] },
  ]},
  { label: 'Administración', items: [
    { label: 'Reportes', icon: BarChart3, path: '/admin/reportes', roles: ['ADMIN'] },
    { label: 'Maestros', icon: SlidersHorizontal, path: '/admin/maestros', roles: ['ADMIN'] },
    { label: 'Usuarios', icon: Users, path: '/admin/usuarios', roles: ['ADMIN'] },
    { label: 'Configuración', icon: Settings, path: '/admin/configuracion', roles: ['ADMIN'] },
  ]},
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const filteredGroups = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(user?.role || '')) }))
    .filter(g => g.items.length > 0);
  const showExpanded = !collapsed || mobileOpen;

  return (
    <aside className={cn(
      'flex flex-col border-r shadow-sm transition-all duration-300 ease-in-out overflow-hidden shrink-0 bg-white dark:bg-slate-800 border-brand-50 dark:border-slate-700',
      mobileOpen ? 'fixed inset-y-0 left-0 z-50 w-64' : 'hidden',
      'md:flex md:relative md:z-20',
      collapsed ? 'md:w-16' : 'md:w-64'
    )}>
      <div className="flex items-center gap-3 px-3 py-4 border-b h-16 shrink-0 border-brand-50 dark:border-slate-700">
        <button onClick={() => navigate('/dashboard')} className="shrink-0 rounded-xl overflow-hidden h-10 w-10 flex items-center justify-center">
          <img src="/assets/Logo_azul_oscuro_alpina.png" alt="Alpina" className="w-9 h-9 object-contain" />
        </button>
        {showExpanded && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.area}</p>
          </div>
        )}
        {mobileOpen && (
          <button onClick={onMobileClose} className="md:hidden ml-auto shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
        {!collapsed && !mobileOpen && (
          <button onClick={onToggle} className="hidden md:block ml-auto shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
      </div>

      <nav className="flex-1 mt-3 px-2 space-y-2 overflow-y-auto no-scrollbar">
        {filteredGroups.map(group => (
          <div key={group.label} className="space-y-0.5">
            {showExpanded && (
              <p className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{group.label}</p>
            )}
            {group.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => mobileOpen && onMobileClose()}
                title={!showExpanded ? item.label : undefined}
                className={({ isActive }) => cn(
                  'w-full flex items-center gap-3 rounded-xl transition-all duration-200 py-2.5',
                  !showExpanded ? 'justify-center px-2' : 'px-3',
                  isActive
                    ? 'bg-brand-50 dark:bg-blue-900/30 text-brand dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                )}
              >
                <item.icon size={20} className="shrink-0" />
                <span className={cn('font-semibold text-[13px] whitespace-nowrap transition-all duration-200', !showExpanded ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100')}>
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-3 mt-auto shrink-0 hidden md:block">
        <button onClick={onToggle} className="w-full flex justify-center p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
