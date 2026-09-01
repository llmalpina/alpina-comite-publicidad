import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, Search, ToggleLeft, ToggleRight, Loader2, KeyRound, ChevronLeft, ChevronRight, Pencil, Trash2, X, List, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { usuariosApi } from '../../../lib/api';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useMaestros } from '../../../contexts/MaestrosContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { cn } from '../../../lib/utils';
import UsoUsuariosPanel from './UsoUsuariosPanel';

const DEFAULT_ROLE_COLOR = 'bg-slate-100 text-slate-700';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  area: string;
  activo: boolean;
  createdAt: string;
  lastLogin?: string;
  loginCount?: number;
}

type UsuariosTab = 'lista' | 'uso';

const UsuariosPage: React.FC = () => {
  const { notify } = useNotifications();
  const { config } = useMaestros();
  const { roles } = useConfig();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'SOLICITANTE', area: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UsuariosTab>('lista');
  const ITEMS_PER_PAGE = 15;

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

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await usuariosApi.updateRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      notify('Rol actualizado', 'success');
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const handleAreaChange = async (userId: string, newArea: string) => {
    if (!newArea) {
      notify('Selecciona un área válida', 'error');
      return;
    }
    try {
      await usuariosApi.updateArea(userId, newArea);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, area: newArea } : u));
      notify('Área actualizada correctamente', 'success');
    } catch (e: any) {
      console.error('Error al actualizar área:', e);
      notify(`Error: ${e.message}`, 'error');
    }
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

  const handleOpenEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.name || !editForm.email) { notify('Completa nombre y correo', 'error'); return; }
    setEditSaving(true);
    try {
      const updated = await usuariosApi.update(editingUser.id, editForm);
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updated } : u));
      setEditingUser(null);
      notify('Usuario actualizado', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`¿Eliminar a ${user.name} (${user.email})? Esta acción no se puede deshacer.`)) return;
    setDeletingId(user.id);
    try {
      await usuariosApi.remove(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      notify('Usuario eliminado', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (!confirm(`¿Resetear la contraseña de ${target.name}? Se le enviará un correo con una nueva contraseña temporal.`)) return;
    try {
      const result = await usuariosApi.resetPassword(userId);
      notify(result.message || 'Contraseña reseteada exitosamente', 'success');
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const roleOptions = [
    ...roles.map(role => ({ id: role.id, label: role.label })),
    ...Array.from(new Set(
      users
        .map(user => user.role)
        .filter(role => role && !roles.some(configuredRole => configuredRole.id === role)),
    )).map(role => ({ id: role, label: role })),
  ];

  const normalizedSearch = search.toLowerCase();
  const filtered = users.filter(u => {
    const matchesSearch =
      u.name?.toLowerCase().includes(normalizedSearch) ||
      u.email?.toLowerCase().includes(normalizedSearch) ||
      u.area?.toLowerCase().includes(normalizedSearch);
    const matchesRole = !roleFilter || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // Paginación
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Reset page cuando cambia la búsqueda o el filtro
  useEffect(() => { setCurrentPage(1); }, [search, roleFilter]);

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxButtons = 7;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión de Usuarios</h1>
          <p className="text-slate-500 dark:text-slate-400">Administra los usuarios, sus roles y el uso de la plataforma.</p>
        </div>
        {activeTab === 'lista' && (
          <Button onClick={() => setShowForm(v => !v)} className="gap-2">
            <UserPlus size={18} /> Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setActiveTab('lista')}
          className={cn('flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
            activeTab === 'lista' ? 'bg-white dark:bg-slate-700 text-[#1e3a5f] shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          <List size={14} /> Lista de usuarios
        </button>
        <button
          onClick={() => setActiveTab('uso')}
          className={cn('flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
            activeTab === 'uso' ? 'bg-white dark:bg-slate-700 text-[#1e3a5f] shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          <BarChart3 size={14} /> Seguimiento de uso
        </button>
      </div>

      {activeTab === 'uso' && (
        loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin" /> Cargando datos de uso...
          </div>
        ) : (
          <UsoUsuariosPanel users={users} />
        )
      )}

      {/* Formulario nuevo usuario */}
      {activeTab === 'lista' && showForm && (
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
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
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

      {/* Filtros */}
      {activeTab === 'lista' && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input placeholder="Buscar por nombre, correo o área..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          aria-label="Filtrar por rol"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">Todos los roles</option>
          {roleOptions.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
        </select>
      </div>
      )}

      {/* Tabla */}
      {activeTab === 'lista' && (
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
                  {paginatedUsers.map(u => (
                    <tr key={u.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors', !u.activo && 'opacity-50')}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-sm font-bold">
                            {u.area?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{u.email}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{u.area || 'Sin área'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={u.area}
                          onChange={e => handleAreaChange(u.id, e.target.value)}
                          className={cn('text-xs px-2 py-1 rounded border bg-white dark:bg-slate-700 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]', 
                            !u.area ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-600'
                          )}
                        >
                          <option value="">Selecciona área</option>
                          {areasActivas.map(a => <option key={a.id} value={a.value}>{a.label}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className={cn(
                            'text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]',
                            roles.find(role => role.id === u.role)?.color ?? DEFAULT_ROLE_COLOR,
                          )}
                        >
                          {!roles.some(role => role.id === u.role) && <option value={u.role}>{u.role}</option>}
                          {roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <Badge className={u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleOpenEdit(u)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Editar usuario">
                            <Pencil size={17} className="text-blue-500" />
                          </button>
                          <button onClick={() => handleResetPassword(u.id)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Resetear contraseña">
                            <KeyRound size={18} className="text-amber-500" />
                          </button>
                          <button onClick={() => handleToggle(u.id)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title={u.activo ? 'Desactivar' : 'Activar'}>
                            {u.activo ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                          </button>
                          <button onClick={() => handleDelete(u)} disabled={deletingId === u.id} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 transition-colors disabled:opacity-50" title="Eliminar usuario">
                            {deletingId === u.id ? <Loader2 size={17} className="animate-spin text-red-500" /> : <Trash2 size={17} className="text-red-500" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedUsers.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-16 text-slate-400 text-sm">No se encontraron usuarios.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Paginación */}
      {activeTab === 'lista' && !loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} usuarios
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {getPageNumbers()[0] > 1 && (
              <>
                <button onClick={() => setCurrentPage(1)} className="w-8 h-8 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700">1</button>
                {getPageNumbers()[0] > 2 && <span className="text-slate-400 px-1">...</span>}
              </>
            )}

            {getPageNumbers().map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'w-8 h-8 rounded text-sm font-medium transition-colors',
                  page === currentPage
                    ? 'bg-[#1e3a5f] text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                )}
              >
                {page}
              </button>
            ))}

            {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
              <>
                {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && <span className="text-slate-400 px-1">...</span>}
                <button onClick={() => setCurrentPage(totalPages)} className="w-8 h-8 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700">{totalPages}</button>
              </>
            )}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal editar usuario */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingUser(null)}>
          <Card className="w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Pencil size={16} /> Editar usuario
              </CardTitle>
              <button onClick={() => setEditingUser(null)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <X size={18} />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nombre completo</label>
                  <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Correo corporativo</label>
                  <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  <p className="text-xs text-slate-400">Si cambias el correo, el usuario deberá iniciar sesión con el nuevo.</p>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
                  <Button type="submit" disabled={editSaving} className="gap-2">
                    {editSaving ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
                    Guardar cambios
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
