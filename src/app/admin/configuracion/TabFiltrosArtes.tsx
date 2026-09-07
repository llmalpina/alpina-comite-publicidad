import React, { useState } from 'react';
import { Plus, Trash2, Save, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useConfig, ArtesFilterConfig } from '../../../contexts/ConfigContext';
import { useNotifications } from '../../../contexts/NotificationContext';

const TabFiltrosArtes: React.FC = () => {
  const { artesFilterConfig, updateArtesFilterConfig } = useConfig();
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<ArtesFilterConfig>(artesFilterConfig);
  const [newEmail, setNewEmail] = useState('');

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@')) {
      notify('Por favor ingresa un email válido', 'error');
      return;
    }
    if (localConfig.allowedSolicitantes.includes(email)) {
      notify('Este email ya está en la lista', 'warning');
      return;
    }
    setLocalConfig(prev => ({
      ...prev,
      allowedSolicitantes: [...prev.allowedSolicitantes, email],
    }));
    setNewEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    setLocalConfig(prev => ({
      ...prev,
      allowedSolicitantes: prev.allowedSolicitantes.filter(e => e !== email),
    }));
  };

  const handleToggleEnabled = () => {
    setLocalConfig(prev => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  };

  const handleToggleRestrict = () => {
    setLocalConfig(prev => ({
      ...prev,
      restrictByEmail: !prev.restrictByEmail,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateArtesFilterConfig(localConfig);
      notify('Configuración de filtros guardada', 'success');
    } catch (e: any) {
      notify(`Error al guardar: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(artesFilterConfig);

  return (
    <div className="space-y-6">
      {/* Información general */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-blue-900 dark:text-blue-300">
            ℹ️ Filtros para Flujo de Artes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200">
          <p className="mb-3">
            Usa estos filtros para controlar qué artes (solicitudes) inician automáticamente el flujo de aprobación por equipos.
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li><strong>Habilitación:</strong> Si está deshabilitada, ningún arte iniciará el flujo automáticamente.</li>
            <li><strong>Tipos de contenido:</strong> Solo los artes con estos tipos disparan el flujo (ej: "PAQUETE_ARTES").</li>
            <li><strong>Filtro por solicitante:</strong> Si está habilitado, SOLO los emails en la lista pueden iniciar el flujo.</li>
            <li><strong>Ejemplo:</strong> Si habilitas "Filtro por solicitante" y solo agregas "valentina@alpina.com", solo sus artes entrarán al flujo automático.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Estado habilitación */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Habilitar Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Flujo de artes activo</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {localConfig.enabled ? '✓ Los artes que cumplan condiciones iniciarán el flujo automáticamente' : '✗ El flujo está deshabilitado'}
              </p>
            </div>
            <Button
              size="sm"
              variant={localConfig.enabled ? 'default' : 'outline'}
              onClick={handleToggleEnabled}
              className="gap-2"
            >
              {localConfig.enabled ? <Check size={14} /> : <X size={14} />}
              {localConfig.enabled ? 'Activo' : 'Inactivo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tipos de contenido permitidos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Tipos de Contenido Permitidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Solo estos tipos de contenido disparan el flujo de artes automáticamente:
          </p>
          <div className="flex flex-wrap gap-2">
            {localConfig.allowedContentTypes.length > 0 ? (
              localConfig.allowedContentTypes.map(ct => (
                <Badge key={ct} variant="secondary" className="bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300">
                  {ct}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">Ninguno configurado (usa defaults del backend)</p>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 p-2 bg-slate-100 dark:bg-slate-800 rounded">
            <strong>Nota:</strong> Por defecto es "PAQUETE_ARTES". Para cambiar esto, edita directamente en el backend o contacta al administrador.
          </div>
        </CardContent>
      </Card>

      {/* Filtro por solicitante */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtro por Solicitante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Restringir por email</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {localConfig.restrictByEmail
                  ? '✓ Solo los emails en la lista pueden iniciar el flujo'
                  : '✗ Cualquier solicitante (con artes de tipo correcto) inicia el flujo'}
              </p>
            </div>
            <Button
              size="sm"
              variant={localConfig.restrictByEmail ? 'default' : 'outline'}
              onClick={handleToggleRestrict}
              className="gap-2"
            >
              {localConfig.restrictByEmail ? <Check size={14} /> : <X size={14} />}
              {localConfig.restrictByEmail ? 'Habilitado' : 'Deshabilitado'}
            </Button>
          </div>

          {localConfig.restrictByEmail && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="valentina.cardozo@alpina.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddEmail()}
                  className="flex-1 h-9 text-sm"
                />
                <Button size="sm" onClick={handleAddEmail} className="gap-1">
                  <Plus size={14} /> Agregar
                </Button>
              </div>

              {localConfig.allowedSolicitantes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Solicitantes permitidos:</p>
                  {localConfig.allowedSolicitantes.map(email => (
                    <div key={email} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-400">
                          {email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{email}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Puede iniciar flujo</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                  ⚠️ <strong>Atención:</strong> Si habilitas este filtro pero no agregas emails, NADIE podrá iniciar el flujo automáticamente.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botón de guardar */}
      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => setLocalConfig(artesFilterConfig)}
          disabled={!hasChanges || saving}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
};

export default TabFiltrosArtes;
