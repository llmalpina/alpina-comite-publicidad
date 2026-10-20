import { useCallback, useEffect, useState } from 'react';
import { mediosApi } from '../../../lib/medios-api';
import type { MedioConfig } from '../../../types/medios';

/**
 * Carga la configuración del módulo (taxonomía + specs + modulo) vía GET /medios/config
 * una vez por montaje. Expone loading/error y un reload() para refrescar tras mutaciones
 * de taxonomía/specs. El backend hace lazy-init idempotente si los items no existen.
 */
export function useMediosConfig() {
  const [config, setConfig] = useState<MedioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mediosApi.getConfig();
      setConfig(data);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la configuración de Medios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { config, loading, error, reload };
}
