import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Clock } from 'lucide-react';

// La bolsa de horas se calculará desde DynamoDB cuando esté implementado.
// Por ahora muestra el área del usuario sin hacer llamadas que fallen.
const BolsaHorasIndicator: React.FC = () => {
  const { user } = useAuth();
  if (!user?.area) return null;

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Clock size={16} className="text-brand" /> Área
        </h4>
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.area}</p>
      <p className="text-xs text-slate-500 mt-1">Rol: {user.role}</p>
    </div>
  );
};

export default BolsaHorasIndicator;
