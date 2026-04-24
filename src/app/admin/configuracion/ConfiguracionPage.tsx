import React, { useState } from 'react';
import { Plus, Trash2, Save, Mail, Shield, Check, X, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useConfig, PermissionKey, NotificationRule, NotificationEvent } from '../../../contexts/ConfigContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { cn } from '../../../lib/utils';

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  crear_solicitud:          'Crear solicitudes',
  ver_solicitudes_propias:  'Ver sus propias solicitudes',
  ver_todas_solicitudes:    'Ver todas las solicitudes',
  revisar_solicitud:        'Revisar solicitudes',
  aprobar_rechazar:         'Aprobar / Rechazar',
  agregar_comentario:       'Agregar comentarios',
  agregar_anotacion_pdf:    'Anotar en PDF',
  subir_version:            'Subir nueva versión',
  subir_fuera_horario:      'Subir fuera de horario',
  enviar_informe:           'Enviar informe semanal',
  ver_reportes:             'Ver reportes',
  gestionar_maestros:       'Gestionar maestros',
  gestionar_usuarios:       'Gestionar usuarios',
  gestionar_roles:          'Gestionar roles',
  configurar_correos:       'Configurar correos',
};

const PERMISSION_GROUPS = [
  { label: 'Solicitudes', keys: ['crear_solicitud', 'ver_solicitudes_propias', 'ver_todas_solicitudes', 'subir_version', 'subir_fuera_horario'] as PermissionKey[] },
  { label: 'Revisión', keys: ['revisar_solicitud', 'aprobar_rechazar', 'agregar_comentario', 'agregar_anotacion_pdf', 'enviar_informe'] as PermissionKey[] },
  { label: 'Administración', keys: ['ver_reportes', 'gestionar_maestros', 'gestionar_usuarios', 'gestionar_roles', 'configurar_correos'] as PermissionKey[] },
];

const COLOR_OPTIONS = [
  'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700',
  'bg-green-100 text-green-700', 'bg-red-100 text-red-700', 'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700',
];

// ─── Tab Roles ────────────────────────────────────────────────────────────────

const TabRoles: React.FC = () => {
  const { roles, addRole, removeRole, togglePermission } = useConfig();
  const { notify } = useNotifications();
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.id || '');
  const [showNew, setShowNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);

  const role = roles.find(r => r.id === selectedRole);

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addRole(newLabel.trim(), newLabel.trim(), newColor);
    setNewLabel('');
    setShowNew(false);
    notify('Rol creado', 'success');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de roles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Roles</p>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setShowNew(v => !v)}>
            <Plus size={14} /> Nuevo
          </Button>
        </div>

        {showNew && (
          <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20 space-y-2 mb-3">
            <Input placeholder="Nombre del rol" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="h-8 text-sm" />
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} className={cn('w-6 h-6 rounded-full border-2 transition-all', c.split(' ')[0], newColor === c ? 'border-slate-700 scale-110' : 'border-transparent')} />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAdd}>Crear</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowNew(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {roles.map(r => (
          <div
            key={r.id}
            onClick={() => setSelectedRole(r.id)}
            className={cn('flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors', selectedRole === r.id ? 'border-[#1e3a5f] bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}
          >
            <div className="flex items-center gap-2">
              <Shield size={16} className={selectedRole === r.id ? 'text-[#1e3a5f]' : 'text-slate-400'} />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge className={cn('text-[10px] px-1.5', r.color)}>{r.permissions.length}</Badge>
              {r.editable && (
                <button onClick={e => { e.stopPropagation(); removeRole(r.id); notify('Rol eliminado', 'info'); }} className="p-1 hover:bg-red-100 text-red-400 rounded transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Permisos del rol seleccionado */}
      <div className="lg:col-span-2">
        {role ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge className={cn('text-sm px-3 py-1', role.color)}>{role.label}</Badge>
                {!role.editable && <span className="text-xs text-slate-400 font-normal">Rol del sistema</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.keys.map(perm => {
                      const has = role.permissions.includes(perm);
                      return (
                        <button
                          key={perm}
                          onClick={() => togglePermission(role.id, perm)}
                          className={cn(
                            'flex items-center gap-2.5 p-2.5 rounded-lg border text-sm text-left transition-all',
                            has ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-300'
                          )}
                        >
                          <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0', has ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}>
                            {has ? <Check size={12} className="text-white" /> : <X size={12} className="text-slate-400" />}
                          </div>
                          <span className="font-medium">{PERMISSION_LABELS[perm]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Selecciona un rol para ver sus permisos</div>
        )}
      </div>
    </div>
  );
};

// ─── Tab Correos ──────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<NotificationEvent, string> = {
  solicitud_creada:            'Solicitud creada',
  solicitud_aprobacion_parcial:'Revisión parcial (un equipo)',
  solicitud_aprobada:          'Sin comentarios',
  solicitud_con_observaciones: 'Con comentarios',
  solicitud_rechazada:         'Rechazada',
  comentario_agregado:         'Comentario del comité',
  nueva_version_subida:        'Nueva versión subida',
  recordatorio_pendientes:     'Recordatorio semanal',
  usuario_creado:              'Usuario creado',
};

const ALL_ROLES = ['SOLICITANTE', 'REVISOR_ARA', 'REVISOR_LEGAL', 'ADMIN'];
const ROLE_LABELS: Record<string, string> = {
  SOLICITANTE:   'Solicitante',
  REVISOR_ARA:   'Revisor ARA',
  REVISOR_LEGAL: 'Revisor Legal',
  ADMIN:         'Administrador',
};

const RuleCard: React.FC<{ rule: NotificationRule }> = ({ rule }) => {
  const { updateRule, removeRule } = useConfig();
  const { notify } = useNotifications();
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState<NotificationRule>(rule);
  const [newEmail, setNewEmail] = useState('');
  const [newCc, setNewCc] = useState('');

  const save = async () => {
    await updateRule(local);
    notify('Regla guardada', 'success');
  };

  const toggleRole = (role: string) => {
    setLocal(r => ({
      ...r,
      toRoles: r.toRoles.includes(role) ? r.toRoles.filter(x => x !== role) : [...r.toRoles, role],
    }));
  };

  const addEmail = () => {
    if (!newEmail.trim() || !newEmail.includes('@')) return;
    setLocal(r => ({ ...r, toEmails: [...r.toEmails, newEmail.trim()] }));
    setNewEmail('');
  };

  const addCc = () => {
    if (!newCc.trim() || !newCc.includes('@')) return;
    setLocal(r => ({ ...r, cc: [...r.cc, newCc.trim()] }));
    setNewCc('');
  };

  return (
    <div className={cn('border rounded-xl overflow-hidden transition-all', local.enabled ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-60')}>
      {/* Header de la regla */}
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800">
        {/* Toggle activo/inactivo */}
        <button
          onClick={async () => { const next = { ...local, enabled: !local.enabled }; setLocal(next); await updateRule(next); }}
          className={cn('relative w-10 h-5 rounded-full transition-colors shrink-0', local.enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}
        >
          <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', local.enabled && 'translate-x-5')} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{local.label}</p>
            <Badge className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{EVENT_LABELS[local.event]}</Badge>
            {local.system && <Badge className="text-[10px] bg-blue-50 text-blue-600">Sistema</Badge>}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{local.description}</p>
          {/* Resumen compacto */}
          {!expanded && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {local.toRoles.map(r => <span key={r} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">{ROLE_LABELS[r] || r}</span>)}
              {local.toEmails.map(e => <span key={e} className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">{e}</span>)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!rule.system && (
            <button onClick={() => { removeRule(rule.id); notify('Regla eliminada', 'info'); }} className="p-1.5 hover:bg-red-50 text-red-400 rounded transition-colors">
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 rounded transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Detalle expandible */}
      {expanded && (
        <div className="border-t bg-slate-50 dark:bg-slate-900 p-4 space-y-4">
          {/* Roles destinatarios */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Enviar a (por rol)</p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                    local.toRoles.includes(role)
                      ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'
                  )}
                >
                  {local.toRoles.includes(role) && <Check size={12} />}
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Los correos de los usuarios con ese rol se resuelven automáticamente.</p>
          </div>

          {/* Emails adicionales fijos */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Emails adicionales (To)</p>
            <div className="flex gap-2 mb-2">
              <Input placeholder="correo@alpina.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmail()} className="h-8 text-sm flex-1" />
              <Button size="sm" onClick={addEmail} className="h-8 gap-1 shrink-0"><Plus size={14} /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {local.toEmails.map(email => (
                <span key={email} className="flex items-center gap-1 text-xs bg-white dark:bg-slate-800 border rounded-full px-2.5 py-1">
                  {email}
                  <button onClick={() => setLocal(r => ({ ...r, toEmails: r.toEmails.filter(e => e !== email) }))} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                </span>
              ))}
              {local.toEmails.length === 0 && <p className="text-xs text-slate-400">Sin emails adicionales</p>}
            </div>
          </div>

          {/* CC */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Copia (CC)</p>
            <div className="flex gap-2 mb-2">
              <Input placeholder="correo@alpina.com" value={newCc} onChange={e => setNewCc(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCc()} className="h-8 text-sm flex-1" />
              <Button size="sm" variant="outline" onClick={addCc} className="h-8 gap-1 shrink-0"><Plus size={14} /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {local.cc.map(email => (
                <span key={email} className="flex items-center gap-1 text-xs bg-white dark:bg-slate-800 border rounded-full px-2.5 py-1">
                  {email}
                  <button onClick={() => setLocal(r => ({ ...r, cc: r.cc.filter(e => e !== email) }))} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                </span>
              ))}
              {local.cc.length === 0 && <p className="text-xs text-slate-400">Sin copias</p>}
            </div>
          </div>

          <Button size="sm" onClick={save} className="gap-2"><Save size={14} />Guardar regla</Button>
        </div>
      )}
    </div>
  );
};

const TabCorreos: React.FC = () => {
  const { emailConfig, updateEmailConfig, addRule, loadingConfig } = useConfig();
  const { notify } = useNotifications();
  // Inicializa con los valores actuales — se sincroniza cuando emailConfig cambia
  const [smtpLocal, setSmtpLocal] = useState({
    smtpHost: emailConfig.smtpHost,
    smtpPort: emailConfig.smtpPort,
    smtpUser: emailConfig.smtpUser,
    smtpPassword: emailConfig.smtpPassword,
    fromName: emailConfig.fromName,
  });

  // Sincroniza cuando llegan los datos de DynamoDB
  React.useEffect(() => {
    setSmtpLocal({
      smtpHost: emailConfig.smtpHost,
      smtpPort: emailConfig.smtpPort,
      smtpUser: emailConfig.smtpUser,
      smtpPassword: emailConfig.smtpPassword,
      fromName: emailConfig.fromName,
    });
  }, [emailConfig.smtpHost, emailConfig.smtpUser]);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRuleLabel, setNewRuleLabel] = useState('');
  const [newRuleEvent, setNewRuleEvent] = useState<NotificationEvent>('solicitud_creada');
  const [newRuleDesc, setNewRuleDesc] = useState('');

  const saveSmtp = async () => {
    await updateEmailConfig(smtpLocal);
    notify('Configuración SMTP guardada', 'success');
  };

  const handleAddRule = async () => {
    if (!newRuleLabel.trim()) return;
    await addRule({ enabled: true, event: newRuleEvent, label: newRuleLabel, description: newRuleDesc, toRoles: [], toEmails: [], cc: [] });
    setNewRuleLabel(''); setNewRuleDesc(''); setShowNewRule(false);
    notify('Regla creada', 'success');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {loadingConfig && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          Cargando configuración desde DynamoDB...
        </div>
      )}
      {/* SMTP */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Mail size={16} />Servidor SMTP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Servidor</label>
              <Input value={smtpLocal.smtpHost} onChange={e => setSmtpLocal(s => ({ ...s, smtpHost: e.target.value }))} placeholder="smtp.office365.com" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Puerto</label>
              <Input type="number" value={smtpLocal.smtpPort} onChange={e => setSmtpLocal(s => ({ ...s, smtpPort: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Usuario (remitente)</label>
            <Input value={smtpLocal.smtpUser} onChange={e => setSmtpLocal(s => ({ ...s, smtpUser: e.target.value }))} placeholder="asist.auto@alpina.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Contraseña</label>
            <Input type="password" value={smtpLocal.smtpPassword} onChange={e => setSmtpLocal(s => ({ ...s, smtpPassword: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nombre del remitente</label>
            <Input value={smtpLocal.fromName} onChange={e => setSmtpLocal(s => ({ ...s, fromName: e.target.value }))} placeholder="Comité Publicidad Alpina" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Correos enviados desde <strong>{smtpLocal.smtpUser}</strong> via {smtpLocal.smtpHost}:{smtpLocal.smtpPort}</p>
            <Button size="sm" onClick={saveSmtp} className="gap-2 shrink-0"><Save size={14} />Guardar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Reglas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Bell size={16} />Reglas de notificación</h3>
            <p className="text-xs text-slate-500 mt-0.5">Cada regla define qué evento dispara un correo y quién lo recibe.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowNewRule(v => !v)} className="gap-1 shrink-0">
            <Plus size={14} /> Nueva regla
          </Button>
        </div>

        {showNewRule && (
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Nombre de la regla</label>
                  <Input placeholder="Ej: Notificar a gerencia" value={newRuleLabel} onChange={e => setNewRuleLabel(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Evento</label>
                  <select value={newRuleEvent} onChange={e => setNewRuleEvent(e.target.value as NotificationEvent)} className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {(Object.keys(EVENT_LABELS) as NotificationEvent[]).map(ev => (
                      <option key={ev} value={ev}>{EVENT_LABELS[ev]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Descripción (opcional)</label>
                <Input placeholder="Describe para qué sirve esta regla" value={newRuleDesc} onChange={e => setNewRuleDesc(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowNewRule(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleAddRule} disabled={!newRuleLabel.trim()}>Crear regla</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {emailConfig.rules.map(rule => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </div>
    </div>
  );
};

// ─── Tab Horario ──────────────────────────────────────────────────────────────

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const TabHorario: React.FC = () => {
  const { scheduleConfig, updateScheduleConfig } = useConfig();
  const { notify } = useNotifications();
  const [local, setLocal] = useState(scheduleConfig);

  React.useEffect(() => { setLocal(scheduleConfig); }, [scheduleConfig]);

  const save = async () => {
    await updateScheduleConfig(local);
    notify('Configuración de horario guardada', 'success');
  };

  const toggleDay = (day: number) => {
    setLocal(prev => ({
      ...prev,
      allowedDays: prev.allowedDays.includes(day)
        ? prev.allowedDays.filter(d => d !== day)
        : [...prev.allowedDays, day].sort(),
    }));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Bell size={16} />Restricción de horario para envío de piezas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle activar/desactivar */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Restricción de horario</p>
              <p className="text-xs text-slate-500 mt-0.5">Cuando está activa, los solicitantes no pueden enviar piezas fuera del horario configurado.</p>
            </div>
            <button
              onClick={() => setLocal(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={cn('relative w-12 h-6 rounded-full transition-colors shrink-0', local.enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}
            >
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', local.enabled && 'translate-x-6')} />
            </button>
          </div>

          {local.enabled && (
            <>
              {/* Hora límite */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora límite de envío</label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number" min={0} max={23}
                    value={local.cutoffHour}
                    onChange={e => setLocal(prev => ({ ...prev, cutoffHour: parseInt(e.target.value) || 0 }))}
                    className="w-20 text-center"
                  />
                  <span className="text-lg font-bold text-slate-400">:</span>
                  <Input
                    type="number" min={0} max={59} step={15}
                    value={String(local.cutoffMinute).padStart(2, '0')}
                    onChange={e => setLocal(prev => ({ ...prev, cutoffMinute: parseInt(e.target.value) || 0 }))}
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-slate-500">
                    ({local.cutoffHour >= 12 ? `${local.cutoffHour === 12 ? 12 : local.cutoffHour - 12}:${String(local.cutoffMinute).padStart(2, '0')} PM` : `${local.cutoffHour}:${String(local.cutoffMinute).padStart(2, '0')} AM`})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Después de esta hora, los solicitantes sin permiso especial no podrán enviar piezas.</p>
              </div>

              {/* Días permitidos */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Días habilitados</label>
                <div className="flex gap-2">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={cn(
                        'w-10 h-10 rounded-lg text-xs font-bold transition-all',
                        local.allowedDays.includes(i)
                          ? 'bg-[#1e3a5f] text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje personalizado */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mensaje al usuario</label>
                <Input
                  value={local.message}
                  onChange={e => setLocal(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="El horario de envío es de lunes a viernes hasta las 5:00 PM."
                />
                <p className="text-[11px] text-slate-400">Este mensaje se muestra cuando intentan enviar fuera de horario.</p>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              {local.enabled
                ? `Envío permitido: ${local.allowedDays.map(d => DAY_LABELS[d]).join(', ')} hasta las ${String(local.cutoffHour).padStart(2, '0')}:${String(local.cutoffMinute).padStart(2, '0')}`
                : 'Sin restricción — se puede enviar en cualquier momento'}
            </p>
            <Button size="sm" onClick={save} className="gap-2 shrink-0"><Save size={14} />Guardar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Nota:</strong> Los usuarios con el permiso "Subir fuera de horario" pueden enviar piezas en cualquier momento.
          Puedes asignar este permiso en la pestaña de Roles y Permisos.
        </p>
      </div>

      {/* Recordatorio semanal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Bell size={16} />Recordatorio semanal de piezas pendientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Enviar recordatorio</p>
              <p className="text-xs text-slate-500 mt-0.5">Envia un correo a los solicitantes con piezas pendientes de subir o publicar.</p>
            </div>
            <button
              onClick={() => setLocal(prev => ({ ...prev, reminderEnabled: !prev.reminderEnabled }))}
              className={cn('relative w-12 h-6 rounded-full transition-colors shrink-0', local.reminderEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}
            >
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', local.reminderEnabled && 'translate-x-6')} />
            </button>
          </div>

          {local.reminderEnabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dia de envio</label>
                  <select
                    value={local.reminderDay}
                    onChange={e => setLocal(prev => ({ ...prev, reminderDay: parseInt(e.target.value) }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora de envio</label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} max={23} value={local.reminderHour} onChange={e => setLocal(prev => ({ ...prev, reminderHour: parseInt(e.target.value) || 0 }))} className="w-20 text-center" />
                    <span className="text-lg font-bold text-slate-400">:</span>
                    <Input type="number" min={0} max={59} step={15} value={String(local.reminderMinute).padStart(2, '0')} onChange={e => setLocal(prev => ({ ...prev, reminderMinute: parseInt(e.target.value) || 0 }))} className="w-20 text-center" />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Recordatorio programado: cada <strong>{DAY_LABELS[local.reminderDay]}</strong> a las {String(local.reminderHour).padStart(2, '0')}:{String(local.reminderMinute).padStart(2, '0')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informe semanal del comité */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Bell size={16} />Informe semanal del comité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Enviar informe automático</p>
              <p className="text-xs text-slate-500 mt-0.5">Envía un resumen de las piezas revisadas con prioridad y comentarios destacados.</p>
            </div>
            <button
              onClick={() => setLocal(prev => ({ ...prev, reportEnabled: !prev.reportEnabled }))}
              className={cn('relative w-12 h-6 rounded-full transition-colors shrink-0', local.reportEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}
            >
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', local.reportEnabled && 'translate-x-6')} />
            </button>
          </div>

          {local.reportEnabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Día</label>
                  <select value={local.reportDay} onChange={e => setLocal(prev => ({ ...prev, reportDay: parseInt(e.target.value) }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora</label>
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={23} value={local.reportHour} onChange={e => setLocal(prev => ({ ...prev, reportHour: parseInt(e.target.value) || 0 }))} className="w-16 text-center" />
                    <span className="font-bold text-slate-400">:</span>
                    <Input type="number" min={0} max={59} step={15} value={String(local.reportMinute).padStart(2, '0')} onChange={e => setLocal(prev => ({ ...prev, reportMinute: parseInt(e.target.value) || 0 }))} className="w-16 text-center" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top piezas</label>
                  <Input type="number" min={1} max={50} value={local.reportTopN} onChange={e => setLocal(prev => ({ ...prev, reportTopN: parseInt(e.target.value) || 10 }))} className="w-20 text-center" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Informe: cada <strong>{DAY_LABELS[local.reportDay]}</strong> a las {String(local.reportHour).padStart(2, '0')}:{String(local.reportMinute).padStart(2, '0')} — Top {local.reportTopN} piezas por prioridad
              </p>
            </div>
          )}

          {/* Botón envío manual */}
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-slate-500">Enviar informe manualmente ahora</p>
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const apiUrl = (import.meta as any).env?.VITE_API_URL as string;
                const sesUrl = (import.meta as any).env?.VITE_SES_LAMBDA_URL as string;
                if (!sesUrl || !apiUrl) { notify('URLs no configuradas', 'error'); return; }
                const token = localStorage.getItem('alpina_id_token');
                // Obtener solicitudes revisadas esta semana
                const solRes = await fetch(`${apiUrl}/solicitudes`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                const solicitudes = await solRes.json();
                const now = new Date();
                const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                const reviewed = solicitudes
                  .filter((s: any) => ['APROBADA', 'APROBADA_OBSERVACIONES', 'RECHAZADA'].includes(s.status) && new Date(s.updatedAt || s.createdAt) >= weekStart)
                  .sort((a: any, b: any) => {
                    const prio = { red: 0, yellow: 1, green: 2 };
                    return (prio[a.priority as keyof typeof prio] ?? 3) - (prio[b.priority as keyof typeof prio] ?? 3);
                  })
                  .slice(0, local.reportTopN);
                // Obtener comentarios destacados
                const piezas = await Promise.all(reviewed.map(async (s: any) => {
                  let highlightedComments: any[] = [];
                  try {
                    const commRes = await fetch(`${apiUrl}/solicitudes/${s.id}/comentarios`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                    const comments = await commRes.json();
                    highlightedComments = (comments || []).filter((c: any) => c.highlighted);
                  } catch {}
                  return { id: s.id, title: s.title, consecutive: s.consecutive, brand: s.brand, status: s.status, priority: s.priority, description: s.description, highlightedComments };
                }));
                // Enviar correo
                await fetch(sesUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify({ template: 'informe_semanal', to: ['nicolas.carreno@alpina.com'], cc: [], data: { piezas } }),
                });
                notify('Informe enviado', 'success');
              } catch (e: any) { notify(e.message || 'Error al enviar', 'error'); }
            }} className="gap-2 shrink-0">
              <Mail size={14} /> Enviar informe ahora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

const ConfiguracionPage: React.FC = () => {
  const [tab, setTab] = useState<'roles' | 'correos' | 'horario'>('roles');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-slate-500 dark:text-slate-400">Gestiona roles, permisos y notificaciones del sistema.</p>
      </div>

      <div className="flex gap-1 border-b">
        {([
          { key: 'roles', label: 'Roles y Permisos', icon: Shield },
          { key: 'correos', label: 'Correos', icon: Mail },
          { key: 'horario', label: 'Horario', icon: Bell },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors', tab === t.key ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400')}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'roles' ? <TabRoles /> : tab === 'correos' ? <TabCorreos /> : <TabHorario />}
    </div>
  );
};

export default ConfiguracionPage;
