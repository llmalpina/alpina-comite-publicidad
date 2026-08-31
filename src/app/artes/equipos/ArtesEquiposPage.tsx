import React, { useState, useEffect, useMemo } from 'react';
import {
  Save, Plus, Trash2, ChevronUp, ChevronDown, Users, Mail, Bell, Loader2,
  PenTool, Settings2, X, Send, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useArtes } from '../../../contexts/ArtesContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { artesApi } from '../../../lib/artes-api';
import { usuariosApi } from '../../../lib/api';
import { useMaestros } from '../../../contexts/MaestrosContext';
import { cn } from '../../../lib/utils';
import { DAY_LABELS } from '../../../types/artes';
import type { ArtesConfig, ArteTeam } from '../../../types/artes';

const COLORES = [
  'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700', 'bg-red-100 text-red-700',
];

const ESTADOS_COMITE = [
  { value: 'APROBADA', label: 'Aprobada sin comentarios' },
  { value: 'APROBADA_OBSERVACIONES', label: 'Aprobada con comentarios' },
  { value: 'PUBLICADA', label: 'Publicada' },
];

/** Tarjeta de un equipo: nombre, integrantes y posición en la secuencia */
const TeamCard: React.FC<{
  team: ArteTeam;
  index: number;
  total: number;
  usuarios: { name: string; email: string }[];
  onChange: (team: ArteTeam) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}> = ({ team, index, total, usuarios, onChange, onMove, onRemove }) => {
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');

  const agregar = (email: string, name?: string) => {
    const limpio = email.trim().toLowerCase();
    if (!limpio || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) return;
    if (team.members.some(m => m.email.toLowerCase() === limpio)) return;
    const nombre = (name || nuevoNombre || usuarios.find(u => u.email.toLowerCase() === limpio)?.name || limpio.split('@')[0]).trim();
    onChange({ ...team, members: [...team.members, { name: nombre, email: limpio }] });
    setNuevoEmail('');
    setNuevoNombre('');
  };

  const disponibles = usuarios.filter(u => !team.members.some(m => m.email.toLowerCase() === u.email.toLowerCase()));

  return (
    <Card className={cn('transition-opacity', !team.activo && 'opacity-60')}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {/* Orden */}
          <div className="flex flex-col items-center gap-0.5 pt-1">
            <button
              onClick={() => onMove(-1)}
              disabled={index === 0 || team.isDesign}
              className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:hover:text-slate-400"
              title="Subir en la secuencia"
            >
              <ChevronUp size={16} />
            </button>
            <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border',
              team.isDesign ? 'bg-pink-50 text-pink-600 border-pink-200' : 'bg-brand-50 text-brand border-brand/10')}>
              {team.isDesign ? <PenTool size={13} /> : index + 1}
            </span>
            <button
              onClick={() => onMove(1)}
              disabled={index === total - 1 || team.isDesign}
              className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:hover:text-slate-400"
              title="Bajar en la secuencia"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={team.label}
                onChange={e => onChange({ ...team, label: e.target.value })}
                placeholder="Nombre del equipo"
                className="h-9 text-sm font-semibold"
              />
              <div className="flex items-center gap-2 shrink-0">
                {COLORES.map(c => (
                  <button
                    key={c}
                    onClick={() => onChange({ ...team, color: c })}
                    className={cn('w-5 h-5 rounded-full border-2 transition-all', c.split(' ')[0],
                      team.color === c ? 'border-slate-700 scale-110' : 'border-transparent')}
                    title="Color"
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input type="checkbox" checked={team.activo} onChange={e => onChange({ ...team, activo: e.target.checked })} className="rounded" />
                Activo en el flujo
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input type="checkbox" checked={team.isDesign} onChange={e => onChange({ ...team, isDesign: e.target.checked })} className="rounded" />
                Equipo de Diseño (recibe las devoluciones)
              </label>
              <Badge className={cn('text-[10px]', team.color)}>
                {team.members.length} {team.members.length === 1 ? 'integrante' : 'integrantes'}
              </Badge>
              <span className="text-[10px] text-slate-400 font-mono">{team.id}</span>
            </div>

            {team.isDesign && (
              <p className="text-[11px] text-pink-600 bg-pink-50 dark:bg-pink-900/20 rounded px-2 py-1.5">
                Este equipo no firma. Recibe el correo cuando algún equipo devuelve el arte y sube la versión corregida.
              </p>
            )}

            {/* Integrantes */}
            <div className="space-y-1.5">
              {team.members.length === 0 && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertCircle size={12} /> Sin integrantes: nadie recibirá los correos de este equipo.
                </p>
              )}
              {team.members.map(m => (
                <div key={m.email} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg px-2.5 py-1.5">
                  <Mail size={12} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{m.name}</span>
                  <span className="text-[11px] text-slate-400 truncate flex-1">{m.email}</span>
                  <button
                    onClick={() => onChange({ ...team, members: team.members.filter(x => x.email !== m.email) })}
                    className="p-0.5 text-slate-300 hover:text-red-500"
                    title="Quitar del equipo"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <select
                  value=""
                  onChange={e => { if (e.target.value) { const u = disponibles.find(x => x.email === e.target.value); if (u) agregar(u.email, u.name); } }}
                  className="flex h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs flex-1"
                >
                  <option value="">Agregar usuario de la plataforma…</option>
                  {disponibles.map(u => <option key={u.email} value={u.email}>{u.name} — {u.email}</option>)}
                </select>
                <div className="flex gap-1">
                  <Input
                    value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    placeholder="Nombre"
                    className="h-8 text-xs w-28"
                  />
                  <Input
                    value={nuevoEmail}
                    onChange={e => setNuevoEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(nuevoEmail); } }}
                    placeholder="correo@alpina.com"
                    className="h-8 text-xs"
                  />
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => agregar(nuevoEmail)} title="Agregar correo">
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <button onClick={onRemove} className="p-1.5 text-slate-300 hover:text-red-500 shrink-0" title="Eliminar equipo">
            <Trash2 size={15} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

/** Editor de una lista de correos (copias) */
const EmailList: React.FC<{ value: string[]; onChange: (v: string[]) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const email = draft.trim().toLowerCase();
    if (!email || value.includes(email)) return;
    onChange([...value, email]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map(e => (
          <span key={e} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-full pl-2.5 pr-1 py-0.5 text-[11px]">
            {e}
            <button onClick={() => onChange(value.filter(x => x !== e))} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
          </span>
        ))}
        {value.length === 0 && <span className="text-[11px] text-slate-400">Sin copias configuradas</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder || 'correo@alpina.com'}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" className="h-8" onClick={add}>Agregar</Button>
      </div>
    </div>
  );
};

const ArtesEquiposPage: React.FC = () => {
  const { config, loading, saveConfig, reload, canGestionarEquipos } = useArtes();
  const { config: maestros } = useMaestros();
  const { notify } = useNotifications();
  // Tipos de contenido activos configurados en Maestros (dinámico, no hardcodeado)
  const tiposContenidoDisponibles = useMemo(
    () => maestros.tiposContenido.filter(t => t.activo).sort((a, b) => a.label.localeCompare(b.label)),
    [maestros.tiposContenido],
  );
  const [local, setLocal] = useState<ArtesConfig>(config);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [usuarios, setUsuarios] = useState<{ name: string; email: string }[]>([]);

  useEffect(() => { setLocal(config); }, [config]);

  // Los integrantes se pueden elegir de los usuarios ya creados en la plataforma
  useEffect(() => {
    usuariosApi.list()
      .then(list => setUsuarios(
        (list || [])
          .filter((u: any) => u.email)
          .map((u: any) => ({ name: u.name || u.email.split('@')[0], email: u.email }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
      ))
      .catch(() => setUsuarios([]));
  }, []);

  const aprobadores = useMemo(
    () => local.teams.filter(t => !t.isDesign).sort((a, b) => a.order - b.order),
    [local.teams],
  );
  const diseno = useMemo(() => local.teams.filter(t => t.isDesign), [local.teams]);

  const actualizarEquipo = (team: ArteTeam) =>
    setLocal(prev => ({ ...prev, teams: prev.teams.map(t => (t.id === team.id ? team : t)) }));

  /** Reordena solo entre equipos aprobadores y reasigna los order consecutivos */
  const moverEquipo = (teamId: string, dir: -1 | 1) => {
    setLocal(prev => {
      const lista = prev.teams.filter(t => !t.isDesign).sort((a, b) => a.order - b.order);
      const i = lista.findIndex(t => t.id === teamId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= lista.length) return prev;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      const reordenados = lista.map((t, idx) => ({ ...t, order: idx + 1 }));
      return {
        ...prev,
        teams: [...reordenados, ...prev.teams.filter(t => t.isDesign)],
      };
    });
  };

  const agregarEquipo = () => {
    const n = local.teams.filter(t => !t.isDesign).length + 1;
    const id = `EQUIPO_${Date.now()}`;
    setLocal(prev => ({
      ...prev,
      teams: [...prev.teams, {
        id, label: `Equipo ${n}`, order: n, activo: true, isDesign: false,
        color: COLORES[n % COLORES.length], members: [],
      }],
    }));
  };

  const eliminarEquipo = (teamId: string) => {
    if (!confirm('¿Eliminar este equipo del flujo? Las firmas históricas se conservan.')) return;
    setLocal(prev => {
      const restantes = prev.teams.filter(t => t.id !== teamId);
      const aprob = restantes.filter(t => !t.isDesign).sort((a, b) => a.order - b.order).map((t, i) => ({ ...t, order: i + 1 }));
      return { ...prev, teams: [...aprob, ...restantes.filter(t => t.isDesign)] };
    });
  };

  const guardar = async () => {
    if (local.teams.filter(t => t.activo && !t.isDesign).length === 0) {
      notify('Debe haber al menos un equipo activo que firme', 'error');
      return;
    }
    setGuardando(true);
    try {
      await saveConfig(local);
      notify('Configuración de equipos guardada', 'success');
    } catch (e: any) {
      notify(e?.message || 'No se pudo guardar la configuración', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const enviarRecordatorio = async () => {
    setEnviando(true);
    try {
      const res = await artesApi.enviarRecordatorio();
      const enviados = res.equipos.filter(e => e.enviado).length;
      notify(
        res.totalPendientes === 0
          ? 'No hay artes pendientes: no se envió ningún correo'
          : `Recordatorio enviado a ${enviados} ${enviados === 1 ? 'equipo' : 'equipos'} (${res.totalPendientes} pendientes)`,
        res.totalPendientes === 0 ? 'info' : 'success',
      );
    } catch (e: any) {
      notify(e?.message || 'No se pudo enviar el recordatorio', 'error');
    } finally {
      setEnviando(false);
    }
  };

  if (!canGestionarEquipos) {
    return (
      <div className="text-center py-20">
        <Users size={48} className="mx-auto text-slate-200 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">Sin acceso</h3>
        <p className="text-slate-500">No tienes permiso para configurar los equipos de artes.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
        <Loader2 size={24} className="animate-spin" /> Cargando configuración...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Equipos y firmas de artes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Define el orden de aprobación, los integrantes de cada equipo y los recordatorios.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reload} disabled={guardando}>Descartar cambios</Button>
          <Button onClick={guardar} disabled={guardando} className="gap-2">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
          </Button>
        </div>
      </div>

      {/* Interruptor general */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Flujo de aprobación por equipos activo</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Si se desactiva, las piezas aprobadas por el comité ya no entran al flujo de firmas.
            </p>
          </div>
          <button
            onClick={() => setLocal(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={cn('relative w-12 h-6 rounded-full transition-colors shrink-0', local.enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}
          >
            <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', local.enabled && 'translate-x-6')} />
          </button>
        </CardContent>
      </Card>

      {/* Secuencia de equipos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Secuencia de firmas</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {aprobadores.filter(t => t.activo).map(t => t.label).join(' → ') || 'Sin equipos activos'}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={agregarEquipo}>
            <Plus size={14} /> Nuevo equipo
          </Button>
        </div>

        {aprobadores.map((team, i) => (
          <TeamCard
            key={team.id}
            team={team}
            index={i}
            total={aprobadores.length}
            usuarios={usuarios}
            onChange={actualizarEquipo}
            onMove={dir => moverEquipo(team.id, dir)}
            onRemove={() => eliminarEquipo(team.id)}
          />
        ))}

        {diseno.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider pt-2">Equipo de ajustes</h2>
            {diseno.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                index={0}
                total={1}
                usuarios={usuarios}
                onChange={actualizarEquipo}
                onMove={() => {}}
                onRemove={() => eliminarEquipo(team.id)}
              />
            ))}
          </>
        )}
      </div>

      {/* Reglas del flujo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Settings2 size={16} /> Reglas del flujo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipos de contenido que entran al flujo</label>
            <p className="text-[11px] text-slate-400 mt-0.5">Se toman de Maestros &gt; Tipos de contenido. Si creas uno nuevo ahí, aparece aquí automáticamente.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
              {tiposContenidoDisponibles.map(ct => {
                const activo = local.contentTypes.includes(ct.value);
                return (
                  <button
                    key={ct.value}
                    onClick={() => setLocal(prev => ({
                      ...prev,
                      contentTypes: activo
                        ? prev.contentTypes.filter(v => v !== ct.value)
                        : [...prev.contentTypes, ct.value],
                    }))}
                    className={cn('text-left text-xs px-2.5 py-2 rounded-lg border transition-colors',
                      activo
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700')}
                  >
                    {ct.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado del comité que dispara el flujo</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ESTADOS_COMITE.map(st => {
                const activo = local.startOnStatuses.includes(st.value);
                return (
                  <button
                    key={st.value}
                    onClick={() => setLocal(prev => ({
                      ...prev,
                      startOnStatuses: activo
                        ? prev.startOnStatuses.filter(v => v !== st.value)
                        : [...prev.startOnStatuses, st.value],
                    }))}
                    className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors',
                      activo ? 'bg-brand text-white border-brand font-semibold' : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-500')}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cuando Diseño sube un ajuste</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {([
                { v: 'FIRST', t: 'Reiniciar desde el primer equipo', d: 'Todos los equipos vuelven a revisar el arte corregido.' },
                { v: 'REJECTING', t: 'Retomar en el equipo que devolvió', d: 'Se conservan las firmas de los equipos anteriores.' },
              ] as const).map(op => (
                <button
                  key={op.v}
                  onClick={() => setLocal(prev => ({ ...prev, onRejectRestart: op.v }))}
                  className={cn('text-left p-3 rounded-lg border transition-colors',
                    local.onRejectRestart === op.v
                      ? 'border-brand bg-brand-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}
                >
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{op.t}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{op.d}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Copia en todos los correos del flujo</label>
            <div className="mt-2">
              <EmailList value={local.ccEmails} onChange={v => setLocal(prev => ({ ...prev, ccEmails: v }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recordatorio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Bell size={16} /> Recordatorio de pendientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Enviar recordatorio automático</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Cada equipo recibe un correo con los artes que están esperando su firma.
              </p>
            </div>
            <button
              onClick={() => setLocal(prev => ({ ...prev, reminder: { ...prev.reminder, enabled: !prev.reminder.enabled } }))}
              className={cn('relative w-12 h-6 rounded-full transition-colors shrink-0', local.reminder.enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}
            >
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', local.reminder.enabled && 'translate-x-6')} />
            </button>
          </div>

          {local.reminder.enabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Día</label>
                  <select
                    value={local.reminder.day}
                    onChange={e => setLocal(prev => ({ ...prev, reminder: { ...prev.reminder, day: parseInt(e.target.value) } }))}
                    className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  >
                    {DAY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={0} max={23}
                      value={local.reminder.hour}
                      onChange={e => setLocal(prev => ({ ...prev, reminder: { ...prev.reminder, hour: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) } }))}
                      className="w-16 text-center"
                    />
                    <span className="font-bold text-slate-400">:</span>
                    <Input
                      type="number" min={0} max={59}
                      value={String(local.reminder.minute).padStart(2, '0')}
                      onChange={e => setLocal(prev => ({ ...prev, reminder: { ...prev.reminder, minute: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) } }))}
                      className="w-16 text-center"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zona (UTC)</label>
                  <Input
                    type="number" min={-12} max={14}
                    value={local.reminder.timezoneOffset}
                    onChange={e => setLocal(prev => ({ ...prev, reminder: { ...prev.reminder, timezoneOffset: parseInt(e.target.value) || -5 } }))}
                    className="w-20 text-center"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Se enviará cada <strong>{DAY_LABELS[local.reminder.day]}</strong> a las{' '}
                {String(local.reminder.hour).padStart(2, '0')}:{String(local.reminder.minute).padStart(2, '0')}{' '}
                (UTC{local.reminder.timezoneOffset >= 0 ? '+' : ''}{local.reminder.timezoneOffset}).
                El horario se evalúa cada hora, no está fijo en el código.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Copia del recordatorio</label>
                <div className="mt-2">
                  <EmailList
                    value={local.reminder.ccEmails}
                    onChange={v => setLocal(prev => ({ ...prev, reminder: { ...prev.reminder, ccEmails: v } }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500">Enviar el recordatorio ahora, sin esperar el horario</p>
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={enviarRecordatorio} disabled={enviando}>
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar ahora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ArtesEquiposPage;
