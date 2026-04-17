import React, { createContext, useContext, useState, useEffect } from 'react';
import { MaestrosConfig, MaestroItem } from '../types';
import { maestrosApi } from '../lib/api';

const DEFAULT_PROMPT = `Eres un experto en regulación publicitaria de alimentos en Colombia.
Analiza la pieza publicitaria adjunta según el ABC de Publicidad Alpina y la normativa vigente
(Resolución 2492 de 2022, Ley 2120 de 2021). Evalúa: claims nutricionales, sellos de advertencia,
uso de marca, lenguaje dirigido a menores y veracidad. Devuelve un JSON con score (0-100) y
observations (array de {category, severity, message, ruleReference, suggestion}).`;

const DEFAULT_CONFIG: MaestrosConfig = {
  marcas: [
    { id: 'm1', label: 'Alpina', value: 'Alpina', activo: true },
    { id: 'm2', label: 'Bon Yurt', value: 'Bon Yurt', activo: true },
    { id: 'm3', label: 'Alpin', value: 'Alpin', activo: true },
    { id: 'm4', label: 'Finesse', value: 'Finesse', activo: true },
    { id: 'm5', label: 'Yox', value: 'Yox', activo: true },
    { id: 'm6', label: 'Avena Alpina', value: 'Avena Alpina', activo: true },
    { id: 'm7', label: 'Arequipe Alpina', value: 'Arequipe Alpina', activo: true },
    { id: 'm8', label: 'Baby Gü', value: 'Baby Gü', activo: true },
    { id: 'm9', label: 'Regeneris', value: 'Regeneris', activo: true },
  ],
  areas: [
    { id: 'a1', label: 'Mercadeo - Bon Yurt', value: 'Mercadeo - Bon Yurt', activo: true },
    { id: 'a2', label: 'Mercadeo - Alpina', value: 'Mercadeo - Alpina', activo: true },
    { id: 'a3', label: 'Trade Marketing', value: 'Trade Marketing', activo: true },
    { id: 'a4', label: 'Retail', value: 'Retail', activo: true },
    { id: 'a5', label: 'Food Service', value: 'Food Service', activo: true },
    { id: 'a6', label: 'Asuntos Regulatorios', value: 'Asuntos Regulatorios', activo: true },
    { id: 'a7', label: 'Legal', value: 'Legal', activo: true },
  ],
  canales: [
    { id: 'c1', label: 'Instagram', value: 'Instagram', activo: true },
    { id: 'c2', label: 'Facebook', value: 'Facebook', activo: true },
    { id: 'c3', label: 'TikTok', value: 'TikTok', activo: true },
    { id: 'c4', label: 'YouTube', value: 'YouTube', activo: true },
    { id: 'c5', label: 'Punto de Venta', value: 'Punto de Venta', activo: true },
    { id: 'c6', label: 'Televisión', value: 'Televisión', activo: true },
    { id: 'c7', label: 'Radio', value: 'Radio', activo: true },
    { id: 'c8', label: 'Valla / Exterior', value: 'Valla / Exterior', activo: true },
    { id: 'c9', label: 'E-commerce', value: 'E-commerce', activo: true },
  ],
  tiposContenido: [
    { id: 't1', label: 'Parrilla de contenido digital, TikTok y marca', value: 'PARRILLA_DIGITAL', activo: true },
    { id: 't2', label: 'Parrilla de contenido de marcas o cuadro de materiales', value: 'PARRILLA_MARCAS', activo: true },
    { id: 't3', label: 'Revisión de guiones para creadores de contenido', value: 'GUIONES_CREADORES', activo: true },
    { id: 't4', label: 'Malla OOH (Out-of-Home)', value: 'MALLA_OOH', activo: true },
    { id: 't5', label: 'Paquete de artes de una marca', value: 'PAQUETE_ARTES', activo: true },
    { id: 't6', label: 'Revisión de guiones y storyboards de comerciales de TV', value: 'GUIONES_TV', activo: true },
    { id: 't7', label: 'Matriz de copys y cuadros de texto', value: 'MATRIZ_COPYS', activo: true },
    { id: 't8', label: 'Q&A de campañas', value: 'QA_CAMPANAS', activo: true },
    { id: 't9', label: 'Landing, página web, piezas para email marketing', value: 'LANDING_WEB_EMAIL', activo: true },
    { id: 't10', label: 'Paquete POP punto de venta (incluye aprox 5 piezas)', value: 'PAQUETE_POP', activo: true },
    { id: 't11', label: 'Comunicados de prensa y publirreportajes', value: 'COMUNICADOS_PRENSA', activo: true },
  ],
  promptIA: DEFAULT_PROMPT,
};

interface MaestrosContextType {
  config: MaestrosConfig;
  updateMarcas: (items: MaestroItem[]) => void;
  updateAreas: (items: MaestroItem[]) => void;
  updateCanales: (items: MaestroItem[]) => void;
  updateTiposContenido: (items: MaestroItem[]) => void;
  updatePromptIA: (prompt: string) => void;
  addItem: (tipo: keyof Omit<MaestrosConfig, 'promptIA'>, label: string) => void;
  removeItem: (tipo: keyof Omit<MaestrosConfig, 'promptIA'>, id: string) => void;
  toggleItem: (tipo: keyof Omit<MaestrosConfig, 'promptIA'>, id: string) => void;
}

const MaestrosContext = createContext<MaestrosContextType | undefined>(undefined);

export const MaestrosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<MaestrosConfig>(() => {
    const saved = localStorage.getItem('alpina_maestros');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  // Carga maestros desde la API y mergea con los defaults/localStorage
  useEffect(() => {
    const currentConfig = JSON.parse(localStorage.getItem('alpina_maestros') || 'null') || DEFAULT_CONFIG;
    (async () => {
      try {
        const [marcas, canales, tiposContenido, areas] = await Promise.all([
          maestrosApi.list('marcas').catch(() => null),
          maestrosApi.list('canales').catch(() => null),
          maestrosApi.list('tiposContenido').catch(() => null),
          maestrosApi.list('areas').catch(() => null),
        ]);
        let promptIA = currentConfig.promptIA;
        try {
          const p = await maestrosApi.getPromptIA();
          if (p?.prompt) promptIA = p.prompt;
        } catch { /* usa el default */ }

        const toItems = (apiItems: any[] | null, fallback: MaestroItem[]) => {
          if (!apiItems || apiItems.length === 0) return fallback;
          return apiItems.map((i: any) => ({
            id: i.id || i.sk || Date.now().toString(),
            label: i.label || i.value || '',
            value: i.value || i.label || '',
            activo: i.activo !== undefined ? i.activo : true,
          }));
        };

        const merged: MaestrosConfig = {
          marcas: toItems(marcas, currentConfig.marcas),
          canales: toItems(canales, currentConfig.canales),
          tiposContenido: toItems(tiposContenido, currentConfig.tiposContenido),
          areas: toItems(areas, currentConfig.areas),
          promptIA,
        };
        setConfig(merged);
        localStorage.setItem('alpina_maestros', JSON.stringify(merged));
      } catch { /* usa lo que hay en localStorage/defaults */ }
    })();
  }, []);

  const save = (next: MaestrosConfig) => {
    setConfig(next);
    localStorage.setItem('alpina_maestros', JSON.stringify(next));
  };

  const updateMarcas = (items: MaestroItem[]) => save({ ...config, marcas: items });
  const updateAreas = (items: MaestroItem[]) => save({ ...config, areas: items });
  const updateCanales = (items: MaestroItem[]) => save({ ...config, canales: items });
  const updateTiposContenido = (items: MaestroItem[]) => save({ ...config, tiposContenido: items });
  const updatePromptIA = (prompt: string) => {
    save({ ...config, promptIA: prompt });
    maestrosApi.updatePromptIA(prompt).catch(() => {});
  };

  const addItem = (tipo: keyof Omit<MaestrosConfig, 'promptIA'>, label: string) => {
    const value = label.toUpperCase().replace(/\s+/g, '_');
    const newItem: MaestroItem = { id: Date.now().toString(), label, value, activo: true };
    save({ ...config, [tipo]: [...(config[tipo] as MaestroItem[]), newItem] });
    // Persiste en API
    maestrosApi.create(tipo, { label, value }).catch(() => {});
  };

  const removeItem = (tipo: keyof Omit<MaestrosConfig, 'promptIA'>, id: string) => {
    save({ ...config, [tipo]: (config[tipo] as MaestroItem[]).filter(i => i.id !== id) });
    maestrosApi.remove(tipo, id).catch(() => {});
  };

  const toggleItem = (tipo: keyof Omit<MaestrosConfig, 'promptIA'>, id: string) => {
    const updated = (config[tipo] as MaestroItem[]).map(i => i.id === id ? { ...i, activo: !i.activo } : i);
    save({ ...config, [tipo]: updated });
    const item = updated.find(i => i.id === id);
    if (item) maestrosApi.update(tipo, id, item).catch(() => {});
  };

  return (
    <MaestrosContext.Provider value={{ config, updateMarcas, updateAreas, updateCanales, updateTiposContenido, updatePromptIA, addItem, removeItem, toggleItem }}>
      {children}
    </MaestrosContext.Provider>
  );
};

export const useMaestros = () => {
  const ctx = useContext(MaestrosContext);
  if (!ctx) throw new Error('useMaestros must be used within MaestrosProvider');
  return ctx;
};
