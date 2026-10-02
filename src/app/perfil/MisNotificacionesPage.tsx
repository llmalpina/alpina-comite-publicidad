import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Save, RefreshCw, Megaphone, Trash2, CheckCircle2 } from 'lucide-react';
import { usuariosApi } from '../../lib/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Página personal: cada usuario configura su propio webhook de Google Chat.
 * Cuando una notificación va dirigida a su correo (comité o artes), además del
 * correo recibe un mensaje en su espacio personal de Google Chat.
 */
const MisNotificacionesPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [webhook, setWebhook] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await usuariosApi.getMiWebhook();
        setWebhook(res?.chatWebhook || '');
      } catch {
        /* si falla, queda vacío */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const guardar = async () => {
    const url = webhook.trim();
    if (url && !/^https:\/\/chat\.googleapis\.com\//.test(url)) {
      notify('La URL debe ser un webhook de Google Chat (https://chat.googleapis.com/...)', 'error');
      return;
    }
    setSaving(true);
    try {
      await usuariosApi.setMiWebhook(url);
      notify(url ? 'Webhook guardado. Ahora recibirás notificaciones en Google Chat.' : 'Webhook eliminado. Ya no recibirás notificaciones por Chat.', 'success');
    } catch (e: any) {
      notify(e?.message || 'No se pudo guardar el webhook', 'error');
    } finally {
      setSaving(false);
    }
  };

  const probar = async () => {
    const url = webhook.trim();
    if (!url) { notify('Pega la URL de tu webhook antes de probar', 'warning'); return; }
    setTesting(true);
    try {
      // Guarda primero para que la prueba use el valor actual, luego prueba vía lambda-ses
      await usuariosApi.setMiWebhook(url);
      const sesUrl = (import.meta as any).env?.VITE_SES_LAMBDA_URL as string;
      const token = localStorage.getItem('alpina_id_token');
      const res = await fetch(sesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'test-chat', webhookUrl: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) notify('Mensaje de prueba enviado a tu espacio de Google Chat', 'success');
      else notify(data.message || 'No se pudo enviar al webhook', 'error');
    } catch (e: any) {
      notify(e?.message || 'Error al probar el webhook', 'error');
    } finally {
      setTesting(false);
    }
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      await usuariosApi.setMiWebhook('');
      setWebhook('');
      notify('Webhook eliminado', 'info');
    } catch (e: any) {
      notify(e?.message || 'No se pudo eliminar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mis Notificaciones</h1>
        <p className="text-slate-500 dark:text-slate-400">Recibe las notificaciones de tus piezas también en Google Chat.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Megaphone size={16} /> Google Chat personal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instrucciones */}
          <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-4 leading-relaxed space-y-2">
            <p className="font-semibold text-slate-800 dark:text-slate-200">¿Cómo obtengo mi URL?</p>
            <ol className="list-decimal list-inside space-y-1 text-[13px]">
              <li>Abre <strong>Google Chat</strong> y crea un espacio solo para ti (ej. "Mis avisos Comité").</li>
              <li>Entra al espacio → haz clic en el nombre del espacio arriba → <em>Apps e integraciones</em>.</li>
              <li>Selecciona <em>Administrar webhooks</em> → <em>Agregar webhook</em>, ponle un nombre y crea.</li>
              <li>Copia la URL que empieza por <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">https://chat.googleapis.com/</code> y pégala abajo.</li>
            </ol>
            <p className="text-[12px] text-slate-500">
              Las notificaciones de tus piezas (comité y flujo de artes) te llegarán a ese espacio, además del correo.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">URL de tu webhook de Google Chat</label>
            <Input
              value={webhook}
              onChange={e => setWebhook(e.target.value)}
              placeholder={loading ? 'Cargando…' : 'https://chat.googleapis.com/v1/spaces/...'}
              disabled={loading}
            />
            {webhook && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 size={12} /> Tienes un webhook configurado.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-between items-center">
            <p className="text-xs text-slate-400">Usuario: {user?.email}</p>
            <div className="flex gap-2">
              {webhook && (
                <Button size="sm" variant="outline" onClick={eliminar} disabled={saving || testing} className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 size={14} /> Quitar
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={probar} disabled={testing || saving || !webhook} className="gap-2">
                {testing ? <RefreshCw size={14} className="animate-spin" /> : <Megaphone size={14} />}
                {testing ? 'Probando…' : 'Probar'}
              </Button>
              <Button size="sm" onClick={guardar} disabled={saving || testing} className="gap-2">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MisNotificacionesPage;
