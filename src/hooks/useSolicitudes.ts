import { useState, useEffect, useCallback } from 'react';
import { solicitudesApi } from '../lib/api';
import { Solicitud } from '../types';
import { useAuth } from '../contexts/AuthContext';

// Marcas asignadas por rol específico de marca
const BRAND_BY_ROLE: Record<string, string> = {
  REVISOR_BOYDORR: 'NUTRICION_-_BOYDORR',
};

export function useSolicitudes() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data = await solicitudesApi.list();
      // Filtrar por marca si el usuario tiene un rol de marca específico
      const brandFilter = user?.role ? BRAND_BY_ROLE[user.role] : undefined;
      if (brandFilter) {
        data = data.filter((s: any) => s.brand === brandFilter);
      }
      setSolicitudes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { fetch(); }, [fetch]);

  return { solicitudes, setSolicitudes, loading, error, refetch: fetch };
}

export function useSolicitud(id: string | undefined) {
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await solicitudesApi.get(id);
      setSolicitud(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { solicitud, setSolicitud, loading, error, refetch: fetch };
}
