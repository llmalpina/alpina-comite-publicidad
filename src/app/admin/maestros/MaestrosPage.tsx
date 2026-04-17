import React, { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useMaestros } from '../../../contexts/MaestrosContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { MaestroItem } from '../../../types';
import { cn } from '../../../lib/utils';

type TipoMaestro = 'marcas' | 'areas' | 'canales' | 'tiposContenido';

const SECCIONES: { key: TipoMaestro; label: string }[] = [
  { key: 'marcas', label: 'Marcas' },
  { key: 'areas', label: 'Áreas' },
  { key: 'canales', label: 'Canales' },
  { key: 'tiposContenido', label: 'Tipos de Contenido' },
];

const ListaMaestro: React.FC<{ tipo: TipoMaestro; items: MaestroItem[] }> = ({ tipo, items }) => {
  const { addItem, removeItem, toggleItem } = useMaestros();
  const { notify } = useNotifications();
  const [nuevo, setNuevo] = useState('');

  const handleAdd = () => {
    if (!nuevo.trim()) return;
    addItem(tipo, nuevo.trim());
    setNuevo('');
    notify('Elemento agregado', 'success');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Nuevo elemento..."
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} className="gap-1 shrink-0">
          <Plus size={16} /> Agregar
        </Button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {items.map(item => (
          <div key={item.id} className={cn(
            'flex items-center justify-between p-3 rounded-lg border text-sm transition-colors',
            item.activo ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-50'
          )}>
            <span className={cn('font-medium', !item.activo && 'line-through text-slate-400')}>{item.label}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleItem(tipo, item.id)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title={item.activo ? 'Desactivar' : 'Activar'}>
                {item.activo ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
              </button>
              <button onClick={() => { removeItem(tipo, item.id); notify('Elemento eliminado', 'info'); }} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MaestrosPage: React.FC = () => {
  const { config, updatePromptIA } = useMaestros();
  const { notify } = useNotifications();
  const [prompt, setPrompt] = useState(config.promptIA);
  const [iaModel, setIaModel] = useState('us.anthropic.claude-sonnet-4-6');
  const [iaEnabled, setIaEnabled] = useState(true);
  const [customModel, setCustomModel] = useState('');
  const [iaByContentType, setIaByContentType] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<TipoMaestro | 'prompt'>('marcas');

  // Cargar modelo, estado y config por tipo desde DynamoDB
  React.useEffect(() => {
    const token = localStorage.getItem('alpina_id_token');
    fetch(`${(import.meta as any).env?.VITE_API_URL}/maestros/config-ia-model`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(items => {
        const s = items.find((i: any) => i.id === 'singleton');
        if (s?.value) setIaModel(s.value);
        if (s?.enabled !== undefined) setIaEnabled(s.enabled);
        if (s?.byContentType) setIaByContentType(s.byContentType);
      }).catch(() => {});
  }, []);

  const handleSavePrompt = () => {
    updatePromptIA(prompt);
    notify('Prompt de IA actualizado', 'success');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Parámetros Maestros</h1>
        <p className="text-slate-500 dark:text-slate-400">Administra los valores parametrizables del sistema.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {SECCIONES.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors',
              activeTab === s.key ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            )}
          >
            {s.label}
            <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
              {config[s.key].filter((i: any) => i.activo).length}
            </span>
          </button>
        ))}
        <button
          onClick={() => setActiveTab('prompt')}
          className={cn(
            'px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors',
            activeTab === 'prompt' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          )}
        >
          Prompt IA
        </button>
      </div>

      {activeTab !== 'prompt' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{SECCIONES.find(s => s.key === activeTab)?.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <ListaMaestro tipo={activeTab as TipoMaestro} items={config[activeTab as TipoMaestro]} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prompt de Pre-validación IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle activar/desactivar IA */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Análisis IA automático</p>
                <p className="text-xs text-slate-500 mt-0.5">Cuando está activo, cada pieza nueva se analiza con IA antes de enviarla al comité.</p>
              </div>
              <button
                onClick={() => setIaEnabled(prev => !prev)}
                className={cn('relative w-12 h-6 rounded-full transition-colors shrink-0', iaEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}
              >
                <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', iaEnabled && 'translate-x-6')} />
              </button>
            </div>

            {/* Selector de modelo */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modelo de IA</label>
              <select value={iaModel} onChange={e => { setIaModel(e.target.value); setCustomModel(''); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="us.anthropic.claude-sonnet-4-6">Claude Sonnet 4.6 (recomendado)</option>
                <option value="us.anthropic.claude-sonnet-4-5-20250929-v1:0">Claude Sonnet 4.5</option>
                <option value="us.anthropic.claude-sonnet-4-20250514-v1:0">Claude Sonnet 4</option>
                <option value="us.anthropic.claude-haiku-4-5-20251001-v1:0">Claude Haiku 4.5 (rápido)</option>
                <option value="us.anthropic.claude-3-7-sonnet-20250219-v1:0">Claude 3.7 Sonnet</option>
                <option value="custom">Otro modelo (escribir ID)</option>
              </select>
              {iaModel === 'custom' && (
                <input type="text" value={customModel} onChange={e => setCustomModel(e.target.value)}
                  placeholder="us.anthropic.claude-xxx-v1:0"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
              )}
              <p className="text-[11px] text-slate-400">Sonnet es más preciso, Haiku es más rápido y económico.</p>
            </div>

            {/* IA por tipo de contenido */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Análisis IA por tipo de contenido</label>
              <p className="text-[11px] text-slate-400 mb-2">Activa o desactiva el análisis IA para cada tipo de pieza.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.tiposContenido.filter(t => t.activo).map(tipo => {
                  const enabled = iaByContentType[tipo.value] !== false;
                  return (
                    <div key={tipo.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{tipo.label}</span>
                      <button
                        onClick={() => setIaByContentType(prev => ({ ...prev, [tipo.value]: !enabled }))}
                        className={cn('relative w-10 h-5 rounded-full transition-colors shrink-0', enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600')}
                      >
                        <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', enabled && 'translate-x-5')} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prompt de análisis</label>
              <textarea
                className="w-full min-h-[280px] p-4 text-sm border rounded-lg focus:ring-2 focus:ring-[#1e3a5f] outline-none font-mono bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            {/* Un solo botón para guardar TODO */}
            <Button onClick={async () => {
              try {
                const { maestrosApi } = await import('../../../lib/api');
                const modelToSave = iaModel === 'custom' ? customModel : iaModel;
                if (!modelToSave) { notify('Selecciona un modelo', 'error'); return; }
                await maestrosApi.update('config-ia-model', 'singleton', { id: 'singleton', tipo: 'config-ia-model', value: modelToSave, enabled: iaEnabled, byContentType: iaByContentType });
                updatePromptIA(prompt);
                notify('Configuración de IA guardada', 'success');
              } catch { notify('Error al guardar', 'error'); }
            }} className="gap-2 w-full">
              <Save size={16} /> Guardar toda la configuración de IA
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MaestrosPage;
