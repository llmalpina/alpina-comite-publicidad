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
  const [activeTab, setActiveTab] = useState<TipoMaestro | 'prompt'>('marcas');

  // Cargar modelo desde DynamoDB
  React.useEffect(() => {
    fetch(`${(import.meta as any).env?.VITE_API_URL}/maestros/config-ia-model`)
      .then(r => r.json())
      .then(items => {
        const s = items.find((i: any) => i.id === 'singleton');
        if (s?.value) setIaModel(s.value);
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Este prompt se envía a Amazon Bedrock junto con el PDF para el análisis automático. Puedes ajustarlo según las necesidades del comité.
            </p>
            {/* Selector de modelo */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modelo de IA</label>
              <div className="flex gap-2">
                <select value={iaModel} onChange={e => setIaModel(e.target.value)}
                  className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="us.anthropic.claude-sonnet-4-6">Claude Sonnet 4.6 (recomendado)</option>
                  <option value="us.anthropic.claude-sonnet-4-5-20250929-v1:0">Claude Sonnet 4.5</option>
                  <option value="us.anthropic.claude-sonnet-4-20250514-v1:0">Claude Sonnet 4</option>
                  <option value="us.anthropic.claude-haiku-4-5-20251001-v1:0">Claude Haiku 4.5 (más rápido y económico)</option>
                  <option value="us.anthropic.claude-3-7-sonnet-20250219-v1:0">Claude 3.7 Sonnet</option>
                  <option value="us.anthropic.claude-3-5-haiku-20241022-v1:0">Claude 3.5 Haiku</option>
                </select>
                <Button variant="outline" onClick={async () => {
                  try {
                    const { maestrosApi } = await import('../../../lib/api');
                    await maestrosApi.update('config-ia-model', 'singleton', { id: 'singleton', tipo: 'config-ia-model', value: iaModel });
                    notify('Modelo guardado', 'success');
                  } catch { notify('Error al guardar modelo', 'error'); }
                }} className="gap-1 shrink-0"><Save size={14} /> Guardar</Button>
              </div>
              <p className="text-[11px] text-slate-400">Sonnet es más preciso, Haiku es más rápido y económico.</p>
            </div>
            <textarea
              className="w-full min-h-[280px] p-4 text-sm border rounded-lg focus:ring-2 focus:ring-[#1e3a5f] outline-none font-mono bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <Button onClick={handleSavePrompt} className="gap-2">
              <Save size={16} /> Guardar Prompt
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MaestrosPage;
