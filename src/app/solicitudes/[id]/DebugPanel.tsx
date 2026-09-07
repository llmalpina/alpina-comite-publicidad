import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Solicitud } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

interface DebugPanelProps {
  solicitud: Solicitud | null;
  canUploadVersion: boolean;
}

/**
 * Panel de diagnóstico: muestra información interna para debugging
 * Útil cuando hay problemas raros que no se ven en la UI normal
 * 
 * USO: Agregar esto al SolicitudDetailPage cuando sea necesario
 * <DebugPanel solicitud={solicitud} canUploadVersion={canUploadVersion} />
 */
const DebugPanel: React.FC<DebugPanelProps> = ({ solicitud, canUploadVersion }) => {
  const { user } = useAuth();

  if (!solicitud || !user) return null;

  // Verificar si el botón debería aparecer
  const buttonShouldShow =
    canUploadVersion &&
    (solicitud.status === 'RECHAZADA' ||
      solicitud.status === 'EN_REVISION' ||
      solicitud.status === 'APROBADA_OBSERVACIONES');

  return (
    <Card className="border-2 border-red-500 bg-red-50 dark:bg-red-900/20 mt-8">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-red-700 dark:text-red-400">🔴 PANEL DE DIAGNÓSTICO (DEBUG)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs font-mono">
        <div className="grid grid-cols-2 gap-3">
          {/* Usuario */}
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
            <div className="font-bold text-red-900 dark:text-red-200">Usuario</div>
            <div className="text-red-800 dark:text-red-300">
              {user.name}
              <br />
              {user.email}
              <br />
              Rol: {user.role}
            </div>
          </div>

          {/* Solicitud */}
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
            <div className="font-bold text-red-900 dark:text-red-200">Solicitud</div>
            <div className="text-red-800 dark:text-red-300">
              ID: {solicitud.id}
              <br />
              Solicitante: {solicitud.solicitanteEmail}
              <br />
              ¿Es de este usuario? {solicitud.solicitanteEmail === user.email ? '✅ SÍ' : '❌ NO'}
            </div>
          </div>

          {/* Estado */}
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded">
            <div className="font-bold text-yellow-900 dark:text-yellow-200">Estado</div>
            <div className="text-yellow-800 dark:text-yellow-300">
              Status: <Badge variant="secondary">{solicitud.status}</Badge>
              <br />
              ¿Es APROBADA_OBSERVACIONES? {solicitud.status === 'APROBADA_OBSERVACIONES' ? '✅ SÍ' : '❌ NO'}
            </div>
          </div>

          {/* Permisos */}
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
            <div className="font-bold text-blue-900 dark:text-blue-200">Permisos</div>
            <div className="text-blue-800 dark:text-blue-300">
              canUploadVersion: {canUploadVersion ? '✅ SÍ' : '❌ NO'}
              <br />
              Rol correcto? {user.role === 'SOLICITANTE' || user.role === 'ADMIN' ? '✅ SÍ' : '❌ NO'}
            </div>
          </div>

          {/* Botón */}
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
            <div className="font-bold text-green-900 dark:text-green-200">Botón "Subir Pieza Final"</div>
            <div className="text-green-800 dark:text-green-300">
              {buttonShouldShow ? '✅ DEBERÍA APARECER' : '❌ NO DEBERÍA APARECER'}
            </div>
          </div>

          {/* Aprobaciones */}
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded">
            <div className="font-bold text-purple-900 dark:text-purple-200">Aprobaciones</div>
            <div className="text-purple-800 dark:text-purple-300">
              ARA: {solicitud.approvalARA?.approved === true ? '✅' : solicitud.approvalARA?.approved === false ? '❌' : '⏳'}
              <br />
              Legal: {solicitud.approvalLegal?.approved === true ? '✅' : solicitud.approvalLegal?.approved === false ? '❌' : '⏳'}
            </div>
          </div>
        </div>

        {!buttonShouldShow && (
          <div className="p-3 bg-red-200 dark:bg-red-800 rounded border border-red-400 dark:border-red-600">
            <div className="font-bold text-red-900 dark:text-red-200 mb-2">⚠️ PROBLEMA DETECTADO</div>
            <div className="text-red-800 dark:text-red-300 space-y-1">
              {!canUploadVersion && <div>• canUploadVersion es FALSE (verifica permisos)</div>}
              {canUploadVersion && solicitud.status !== 'RECHAZADA' && solicitud.status !== 'EN_REVISION' && solicitud.status !== 'APROBADA_OBSERVACIONES' && (
                <div>
                  • Status es "{solicitud.status}" (debería ser uno de: RECHAZADA, EN_REVISION, APROBADA_OBSERVACIONES)
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DebugPanel;
