import React, { useState, useEffect } from 'react';
import { UserPlus, Search, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { usuariosApi } from '../../../lib/api';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useMaestros } from '../../../contexts/MaestrosContext';
import { UserRole } from '../../../types';
import { cn } from '../../../lib/utils';

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  SOLICITANTE:   { label: 'Solicitante',        color: 'bg-blue-100 text-blue-700' },
  REVISOR_ARA:   { label: 'Revisor ARA',         color: 'bg-purple-100 text-purple-700' },
  REVISOR_LEGAL: { label: 'Revisor Legal',       color: 'bg-amber-100 text-amber-700' },
  ADMIN:         { label: 'Administrador',       color: 'bg-slate-200 text-slate-700' },
};

const ROLES: UserRole[] = ['SOLICITANTE', 'REVISOR_ARA', 'REVISOR_LEGAL', 'ADMIN'];

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  area: string;
  activo: boolean;
  createdAt: string;
}

const UsuariosPage: React.FC = () => {
  const { notify } = useNotifications();
  const { config } = useMaestros();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'SOLICITANTE' as UserRole, area: '' });

  const areasActivas = config.areas.filter(a => a.activo);

  useEffect(() => {
    usuariosApi.list()
      .then(setUsers)
      .catch(e => notify(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.role) { notify('Completa todos los campos', 'error'); return; }
    setSaving(true);
    try {
      const newUser = await usuariosApi.create(form);
      setUsers(prev => [newUser, ...prev]);
      setForm({ name: '', email: '', role: 'SOLICITANTE', area: '' });
      setShowForm(false);
      notify(`Usuario ${newUser.name} creado. Se envió correo de bienvenida.`, 'success');
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await usuariosApi.updateRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      notify('Rol actualizado', 'success');
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const handleToggle = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    try {
      await usuariosApi.disable(userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, activo: !u.activo } : u));
      notify(target.activo ? 'Usuario desactivado' : 'Usuario activado', 'info');
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.area?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión de Usuarios</h1>
          <p className="text-slate-500 dark:text-slate-400">Administra los usuarios y sus roles en la plataforma.</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="gap-2">
          <UserPlus size={18} /> Nuevo Usuario
        </Button>
      </div>

      {/* Formulario nuevo usuario */}
      {showForm && (
        <Card className="border-blue-100 bg-blue-50/50 dark:bg-blue-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <UserPlus size={16} /> Crear nuevo usuario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nombre completo</label>
                <Input placeholder="Ej: María García" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Correo corporativo</label>
                <Input type="email" placeholder="nombre@alpina.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rol</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r].label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Área</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                  <option value="">Selecciona área</option>
                  {areasActivas.map(a => <option key={a.id} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Crear y enviar invitación
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input placeholder="Buscar por nombre, correo o área..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin" /> Cargando usuarios...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b">
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Área</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rol</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(u => (
                    <tr key={u.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors', !u.activo && 'opacity-50')}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-sm font-bold">
                            {u.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{u.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{u.area || '—'}</td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                          className={cn('text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]', ROLE_LABELS[u.role]?.color)}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r].label}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <Badge className={u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <button onClick={() => handleToggle(u.id)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title={u.activo ? 'Desactivar' : 'Activar'}>
                          {u.activo ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-16 text-slate-400 text-sm">No se encontraron usuarios.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsuariosPage;
