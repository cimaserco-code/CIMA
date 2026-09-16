import React, { useEffect, useState } from "react";
import { 
  History, Search, Filter, RefreshCw, Upload, Plus, Pencil, Trash2, 
  FileText, Briefcase, CheckSquare, Calendar, Users, DollarSign, Contact, 
  Check, Copy, Database, ShieldAlert, Clock
} from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import { fetchActivities } from "@/lib/activityLogger";
import { useAuth } from "@/lib/AuthContext";

const MODULE_ICONS = {
  Documentos: FileText,
  Casos: Briefcase,
  Tareas: CheckSquare,
  Calendario: Calendar,
  Clientes: Contact,
  Honorarios: DollarSign,
  Equipo: Users,
  General: History
};

const ACTION_STYLES = {
  SUBIR: { label: "Subida", color: "text-sky-400 bg-sky-400/10 border-sky-400/20", icon: Upload },
  CREAR: { label: "Creación", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: Plus },
  EDITAR: { label: "Edición", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: Pencil },
  ELIMINAR: { label: "Eliminación", color: "text-rose-400 bg-rose-400/10 border-rose-400/20", icon: Trash2 }
};

const SQL_SNIPPET = `-- Ejecuta este script en Supabase SQL Editor para crear la tabla oficial de auditoría:
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total en activity_logs" ON public.activity_logs FOR ALL USING (auth.role() = 'authenticated');`;

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Hace un momento";
  if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Actualizaciones({ embedded = false }) {
  const { profile, permissions } = useAuth();
  const isAdmin = permissions?.can_manage_users || ['admin', 'direccion general'].includes(profile?.role?.toLowerCase());

  const [activities, setActivities] = useState([]);
  const [source, setSource] = useState("activity_logs");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [copiedSql, setCopiedSql] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const result = await fetchActivities();
    setActivities(result.data || []);
    setSource(result.source);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const filtered = activities.filter((act) => {
    // Module filter
    if (filterModule !== "all" && act.module !== filterModule) return false;
    // Action filter
    if (filterAction !== "all" && act.action !== filterAction) return false;
    // Search filter
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const userName = (act.user_name || "").toLowerCase();
    const userEmail = (act.user_email || "").toLowerCase();
    const desc = (act.description || "").toLowerCase();
    const mod = (act.module || "").toLowerCase();
    return userName.includes(term) || userEmail.includes(term) || desc.includes(term) || mod.includes(term);
  });

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader 
          title="Actualizaciones e Historial" 
          subtitle="Registro cronológico de cambios, creaciones y eliminaciones realizadas en la firma"
          action={
            <button 
              onClick={loadData}
              disabled={loading}
              className="border border-[#1A1A1A] hover:border-[#C9A227]/50 bg-[#080808] text-[#F5F5F3]/70 hover:text-[#C9A227] text-xs px-4 py-2.5 flex items-center gap-2 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-[#C9A227]" : ""} />
              <span>Actualizar</span>
            </button>
          }
        />
      )}

      {/* Admin Notice if using fallback */}
      {isAdmin && source === "messages_fallback" && (
        <div className="p-4 bg-[#0F0F0F] border border-[#C9A227]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database size={18} className="text-[#C9A227] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-[#F5F5F3] font-medium">Registro activo mediante canal de respaldo</p>
              <p className="text-[11px] text-[#F5F5F3]/50 mt-0.5">
                Las actividades se están guardando con éxito. Para habilitar la tabla dedicada <code className="text-[#C9A227]">activity_logs</code> en Supabase, puedes ejecutar el script SQL oficial.
              </p>
            </div>
          </div>
          <button
            onClick={handleCopySql}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A227] text-[#080808] text-[11px] uppercase tracking-wider font-semibold hover:bg-[#A8841D] transition-colors flex-shrink-0"
          >
            {copiedSql ? <Check size={13} /> : <Copy size={13} />}
            {copiedSql ? "Copiado ✓" : "Copiar Script SQL"}
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F5F5F3]/20" />
          <input
            type="text"
            className="w-full bg-[#080808] border border-[#1A1A1A] pl-11 pr-8 py-2.5 text-xs text-[#F5F5F3] placeholder:text-[#F5F5F3]/30 focus:outline-none focus:border-[#C9A227] transition-colors"
            placeholder="Buscar por usuario, acción o descripción…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#F5F5F3]/30 hover:text-[#F5F5F3] p-1 text-xs transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2.5 focus:outline-none focus:border-[#C9A227]"
        >
          <option value="all">Todos los módulos</option>
          <option value="Documentos">Documentos</option>
          <option value="Casos">Casos</option>
          <option value="Tareas">Tareas</option>
          <option value="Calendario">Calendario</option>
          <option value="Clientes">Clientes</option>
          <option value="Honorarios">Honorarios</option>
        </select>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2.5 focus:outline-none focus:border-[#C9A227]"
        >
          <option value="all">Todas las acciones</option>
          <option value="SUBIR">Subidas</option>
          <option value="CREAR">Creaciones</option>
          <option value="EDITAR">Ediciones</option>
          <option value="ELIMINAR">Eliminaciones</option>
        </select>
      </div>

      {/* Activity Timeline List */}
      {loading ? (
        <p className="text-[#F5F5F3]/30 text-sm">Cargando historial de actividad…</p>
      ) : (
        <div className="bg-[#080808] border border-[#1A1A1A] divide-y divide-[#1A1A1A]">
          {filtered.map((act) => {
            const ModIcon = MODULE_ICONS[act.module] || History;
            const actionStyle = ACTION_STYLES[act.action] || {
              label: act.action || "Acción",
              color: "text-[#F5F5F3]/60 bg-[#F5F5F3]/5 border-[#1A1A1A]",
              icon: History
            };
            const ActionIcon = actionStyle.icon;

            return (
              <div 
                key={act.id} 
                className="p-4 hover:bg-[#0F0F0F] transition-colors flex items-start sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-[#121212] border border-[#1E1E1E] flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0 text-[#C9A227] group-hover:border-[#C9A227]/40 transition-colors">
                    <ModIcon size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#F5F5F3]">{act.user_name}</span>
                      {act.user_email && (
                        <span className="text-[10px] text-[#F5F5F3]/30 hidden md:inline">
                          ({act.user_email})
                        </span>
                      )}
                      <span className={`text-[8px] tracking-wider uppercase px-2 py-0.5 border ${actionStyle.color} font-medium`}>
                        {actionStyle.label}
                      </span>
                      <span className="text-[9px] text-[#C9A227] bg-[#C9A227]/10 px-2 py-0.5 tracking-wider uppercase border border-[#C9A227]/20">
                        {act.module}
                      </span>
                    </div>

                    <p className="text-xs text-[#F5F5F3]/80 break-words leading-relaxed">
                      {act.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end flex-shrink-0 text-right">
                  <span className="text-[11px] text-[#F5F5F3]/40 flex items-center gap-1 whitespace-nowrap">
                    <Clock size={11} className="text-[#C9A227]/60" />
                    {formatRelativeTime(act.created_at)}
                  </span>
                  <span className="text-[9px] text-[#F5F5F3]/20 hidden sm:inline mt-0.5">
                    {new Date(act.created_at).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <History size={36} className="text-[#F5F5F3]/10 mx-auto mb-3" />
              <p className="text-[#F5F5F3]/20 text-sm">
                {searchTerm ? "No se encontraron actividades para esta búsqueda" : "Sin actividades registradas aún"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
