import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Search, Eye, Loader2, FileText, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { STATUS_LABELS } from "../../lib/constants";
import { formatDate, cn } from "../../lib/utils";
import { useSolicitudes } from "../../hooks/useSolicitudes";
import { useConfig } from "../../contexts/ConfigContext";
import { useAuth } from "../../contexts/AuthContext";
import { solicitudesApi } from "../../lib/api";
import { RequestStatus } from "../../types";

const STATUS_FILTER_OPTIONS: { value: RequestStatus | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "ENVIADA", label: "Enviada" },
  { value: "EN_REVISION", label: "En Revision" },
  { value: "APROBADA", label: "Aprobada" },
  { value: "APROBADA_OBSERVACIONES", label: "Aprobada con Obs." },
  { value: "RECHAZADA", label: "Rechazada" },
  { value: "PUBLICADA", label: "Publicada" },
];

const SolicitudesPage: React.FC = () => {
  const { user } = useAuth();
  const { canSubmitNow } = useConfig();
  const scheduleCheck = canSubmitNow(user?.role || 'SOLICITANTE');
  const { solicitudes, setSolicitudes, loading, error } = useSolicitudes();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "">("");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = solicitudes
    .filter((s) => {
      const matchSearch =
        s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.consecutive?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.brand?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter ? s.status === statusFilter : s.status !== "PUBLICADA";
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const da = a.createdAt || "";
      const db = b.createdAt || "";
      return sortAsc ? da.localeCompare(db) : db.localeCompare(da);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mis Solicitudes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona y haz seguimiento a tus piezas publicitarias.</p>
        </div>
        {scheduleCheck.allowed ? (
          <Link to="/solicitudes/nueva"><Button className="gap-2"><PlusCircle size={18} />Nueva Solicitud</Button></Link>
        ) : (
          <div className="flex items-center gap-2"><span className="text-xs text-red-500 max-w-[200px] text-right">{scheduleCheck.message}</span><Button className="gap-2" disabled><PlusCircle size={18} />Nueva Solicitud</Button></div>
        )}
      </div>

      {!statusFilter && solicitudes.filter((s) => s.status === "PUBLICADA").length > 0 && (
        <button onClick={() => setStatusFilter("PUBLICADA")} className="flex items-center gap-2 text-xs text-violet-600 hover:text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 transition-colors">
          <span className="w-2 h-2 bg-violet-500 rounded-full" />
          {solicitudes.filter((s) => s.status === "PUBLICADA").length} pieza(s) publicada(s) ocultas
        </button>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input placeholder="Buscar por titulo, consecutivo o marca..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RequestStatus | "")} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[180px]">
              {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {(searchTerm || statusFilter) && (
              <Button variant="ghost" size="sm" className="gap-1 text-slate-500" onClick={() => { setSearchTerm(""); setStatusFilter(""); }}>
                <X size={14} /> Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 size={24} className="animate-spin" /> Cargando solicitudes...
        </div>
      )}

      {error && (
        <div className="text-center py-10 text-red-500 bg-red-50 rounded-lg border border-red-200">
          <p className="font-medium">Error al cargar solicitudes</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-3">
          {filtered.length > 0 ? filtered.map((solicitud) => (
            <Card key={solicitud.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center">
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-50 dark:bg-blue-900/20 rounded flex items-center justify-center text-brand font-bold border border-brand/10">
                          {solicitud.brand?.[0] || "?"}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white">{solicitud.title}</h3>
                          <p className="text-xs text-slate-500">{solicitud.consecutive} · {solicitud.brand}</p>
                        </div>
                      </div>
                      <Badge className={STATUS_LABELS[solicitud.status]?.color || ""}>
                        {STATUS_LABELS[solicitud.status]?.label || solicitud.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tipo</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{solicitud.contentType?.replace("_", " ")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer hover:text-slate-600 flex items-center gap-1" onClick={() => setSortAsc((v) => !v)}>
                          Creada {sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{formatDate(solicitud.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fecha Limite</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{formatDate(solicitud.deadline)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Aprobaciones</p>
                        <div className="flex gap-1 mt-1">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", (solicitud as any).approvalARA?.approved ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                            ARA {(solicitud as any).approvalARA?.approved ? "\u2713" : "\u2014"}
                          </span>
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", (solicitud as any).approvalLegal?.approved ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                            Legal {(solicitud as any).approvalLegal?.approved ? "\u2713" : "\u2014"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t md:border-t-0 md:border-l p-3 flex md:flex-col gap-2 justify-center bg-slate-50 dark:bg-slate-800/50">
                    <Link to={"/solicitudes/" + solicitud.id} className="flex-1 md:flex-none">
                      <Button variant="outline" size="sm" className="w-full gap-2"><Eye size={14} />Detalles</Button>
                    </Link>
                    {(solicitud.status === "APROBADA" || solicitud.status === "APROBADA_OBSERVACIONES") && (
                      <Button size="sm" className="w-full gap-1 bg-violet-600 hover:bg-violet-700 text-white text-xs"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            await solicitudesApi.updateStatus(solicitud.id, "PUBLICADA");
                            setSolicitudes((prev) => prev.map((s) => s.id === solicitud.id ? { ...s, status: "PUBLICADA" as any } : s));
                          } catch {}
                        }}>
                        Publicada
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-lg border border-dashed">
              <FileText size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">No se encontraron solicitudes</h3>
              <p className="text-slate-500">Crea tu primera solicitud para comenzar.</p>
              <Link to="/solicitudes/nueva" className="mt-4 inline-block">
                <Button variant="outline">Crear solicitud</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SolicitudesPage;
