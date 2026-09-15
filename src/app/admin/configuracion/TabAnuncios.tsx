/**
 * TabAnuncios — configuración del popup de anuncios/mensajes globales.
 *
 * El admin define un mensaje (mantenimiento, recordatorio, etc.), lo activa y
 * opcionalmente lo programa por rango de fechas, franja horaria y días de la
 * semana. El popup se muestra a todos los usuarios al ingresar y respeta el
 * "no volver a mostrar" por versión del mensaje.
 */
import React, { useState } from 'react';
import { Save, Check, X, Megaphone, AlertTriangle, Wrench, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useConfig, AnnouncementConfig } from '../../../contexts/ConfigContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { cn } from '../../../lib/utils';

const DAYS = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' },
];

const TYPES: { value: AnnouncementConfig['type']; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'info', label: 'Informativo', icon: Megaphone, color: '#1450C9' },
  { value: 'warning', label: 'Advertencia', icon: AlertTriangle, color: '#d97706' },
  { value: 'maintenance', label: 'Mantenimiento', icon: Wrench, color: '#7c3aed' },
];

const TabAnuncios: React.FC = () => {
  const { announcementConfig, updateAnnouncementConfig, isAnnouncementActive } = useConfig();
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<AnnouncementConfig>(announcementConfig);

  const set = <K extends keyof AnnouncementConfig>(key: K, value: AnnouncementConfig[K]) =>
    setCfg(prev => ({ ...prev, [key]: value }));

  const toggleDay = (d: number) =>
    setCfg(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(d) ? prev.daysOfWeek.filter(x => x !== d) : [...prev.daysOfWeek, d],
    }));

  const hasChanges = JSON.stringify(cfg) !== JSON.stringify(announcementConfig);

  const handleSave = async () => {
    if (cfg.enabled && !cfg.message.trim()) {
      notify('Escribe el mensaje del anuncio antes de activarlo', 'error');
      return;
    }
    setSaving(true);
    try {
      // Si cambió el contenido del mensaje, sube la versión para reiniciar el
      // "no volver a mostrar" de todos los usuarios.
      let next = cfg;
      const contentChanged = cfg.title !== announcementConfig.title || cfg.message !== announcementConfig.message;
      if (contentChanged) {
        next = { ...cfg, version: `v${Date.now()}` };
        setCfg(next);
      }
      await updateAnnouncementConfig(next);
      notify('Anuncio guardado', 'success');
    } catch (e: any) {
      notify(`Error al guardar: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeNow = isAnnouncementActive();

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-blue-900 dark:text-blue-300">ℹ️ Anuncios / Avisos a usuarios</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200">
          <p className="mb-2">Muestra un mensaje emergente a todos los usuarios al ingresar. Útil para avisos de mantenimiento o recordatorios ("suban bien la información").</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Puedes <strong>programarlo</strong> por rango de fechas, franja horaria y días de la semana.</li>
            <li>El usuario puede marcar <strong>"no volver a mostrar"</strong>; si editas el mensaje, vuelve a aparecer para todos.</li>
            <li>Mientras esté activo, queda accesible desde la 🔔 campana del encabezado.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Activación */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Anuncio activo</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {cfg.enabled
                  ? (activeNow ? '✓ Visible ahora (dentro de la ventana programada)' : '⏳ Activado, pero fuera de la ventana de fecha/hora/día configurada')
                  : '✗ Desactivado'}
              </p>
            </div>
            <Button size="sm" variant={cfg.enabled ? 'default' : 'outline'} onClick={() => set('enabled', !cfg.enabled)} className="gap-2">
              {cfg.enabled ? <Check size={14} /> : <X size={14} />}
              {cfg.enabled ? 'Activo' : 'Inactivo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenido */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Contenido del mensaje</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Título</label>
            <Input value={cfg.title} onChange={e => set('title', e.target.value)} placeholder="Ej: Mantenimiento programado" className="mt-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mensaje</label>
            <textarea
              value={cfg.message}
              onChange={e => set('message', e.target.value)}
              placeholder="Ej: El próximo lunes de 8:00 a. m. a 5:00 p. m. la plataforma estará en mantenimiento..."
              className="mt-1 w-full min-h-[120px] resize-y p-3 text-sm border rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-400 outline-none leading-relaxed"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tipo / Estilo</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TYPES.map(t => (
                <button key={t.value} onClick={() => set('type', t.value)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    cfg.type === t.value ? 'text-white shadow' : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200')}
                  style={cfg.type === t.value ? { backgroundColor: t.color, borderColor: t.color } : undefined}>
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" checked={cfg.dismissible} onChange={e => set('dismissible', e.target.checked)} className="rounded" />
            Permitir "no volver a mostrar"
          </label>
        </CardContent>
      </Card>

      {/* Programación */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Programación (opcional)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Deja los campos vacíos para mostrar siempre que el anuncio esté activo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fecha inicio</label>
              <Input type="date" value={cfg.startDate} onChange={e => set('startDate', e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fecha fin</label>
              <Input type="date" value={cfg.endDate} onChange={e => set('endDate', e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hora inicio (0-23)</label>
              <Input type="number" min={0} max={23} value={cfg.startHour ?? ''} onChange={e => set('startHour', e.target.value === '' ? null : Math.max(0, Math.min(23, Number(e.target.value))))} placeholder="—" className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hora fin (0-23)</label>
              <Input type="number" min={0} max={23} value={cfg.endHour ?? ''} onChange={e => set('endHour', e.target.value === '' ? null : Math.max(0, Math.min(23, Number(e.target.value))))} placeholder="—" className="mt-1 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Días de la semana</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {DAYS.map(d => (
                <button key={d.value} onClick={() => toggleDay(d.value)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    cfg.daysOfWeek.includes(d.value) ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200')}>
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Sin selección = todos los días.</p>
          </div>
        </CardContent>
      </Card>

      {/* Vista previa */}
      {(cfg.title || cfg.message) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Eye size={14} /> Vista previa</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center gap-3 p-4" style={{ backgroundColor: `${(TYPES.find(t => t.value === cfg.type)?.color || '#1450C9')}15` }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: TYPES.find(t => t.value === cfg.type)?.color }}>
                  {React.createElement(TYPES.find(t => t.value === cfg.type)?.icon || Megaphone, { size: 18, className: 'text-white' })}
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">{cfg.title || 'Aviso'}</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{cfg.message || 'Sin mensaje'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button variant="outline" onClick={() => setCfg(announcementConfig)} disabled={!hasChanges || saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={!hasChanges || saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar anuncio'}
        </Button>
      </div>
    </div>
  );
};

export default TabAnuncios;
