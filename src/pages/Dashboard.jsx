import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Briefcase, CheckSquare, Calendar, Users, ArrowUpRight, Clock } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import StatCard from "@/components/legal/StatCard";
import { useAuth } from "@/lib/AuthContext";

export default function Dashboard() {
  const { profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, tRes, eRes, mRes, aRes] = await Promise.all([
          supabase.from('cases').select('*'),
          supabase.from('tasks').select('*'),
          supabase.from('calendar_events').select('*'),
          supabase.from('team_members').select('*'),
          supabase.from('areas').select('*')
        ]);
        if (cRes.data) setCases(cRes.data);
        if (tRes.data) setTasks(tRes.data);
        if (eRes.data) setEvents(eRes.data);
        if (mRes.data) setMembers(mRes.data);
        if (aRes.data) setAreas(aRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-[#F5F5F3]/30 text-sm">Cargando Inicio…</div>;

  // Filter lists based on Area:
  // If not admin, only show cases belonging to user's assigned area.
  // And only show tasks/events associated with those visible cases (or with no case).
  const visibleCases = cases.filter(c => isAdmin || c.area_id === profile?.area_id);
  const visibleTasks = tasks.filter(t => !t.case_id || visibleCases.some(c => c.id === t.case_id));
  const visibleEvents = events.filter(e => !e.case_id || visibleCases.some(c => c.id === e.case_id));

  const activeCasesCount = visibleCases.filter((c) => c.status === "activo" || c.status === "en_proceso").length;
  const pendingTasksCount = visibleTasks.filter((t) => t.status !== "completada").length;
  
  const upcomingEvents = visibleEvents.filter((e) => new Date(e.event_date) >= new Date()).slice(0, 5);
  const recentCases = visibleCases.slice(0, 5);
  const upcomingTasks = visibleTasks.filter((t) => t.status !== "completada").sort((a, b) => new Date(a.due_date || "2999") - new Date(b.due_date || "2999")).slice(0, 5);

  const statusColors = { activo: "text-[#C9A227]", en_proceso: "text-yellow-400", en_espera: "text-[#F5F5F3]/40", cerrado: "text-green-400", archivado: "text-[#F5F5F3]/20" };
  const priorityColors = { urgente: "text-red-500", alta: "text-red-400", media: "text-yellow-400", baja: "text-[#F5F5F3]/40" };

  // Find user area name
  const userArea = areas.find(a => a.id === profile?.area_id)?.name || (isAdmin ? "Todas las Áreas" : "Sin Área Asignada");

  return (
    <div>
      <PageHeader title="Inicio" subtitle="Resumen general de la firma" />

      {/* Welcome Banner */}
      <div className="mb-6 bg-[#080808] border border-[#1A1A1A] p-6 relative overflow-hidden group">
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-5 group-hover:opacity-10 transition-opacity">
          <Briefcase size={200} className="text-[#C9A227]" />
        </div>
        <h1 className="text-[#F5F5F3] text-lg sm:text-xl font-heading tracking-wide">
          Bienvenido, <span className="text-[#C9A227]">{profile?.full_name}</span>
        </h1>
        <p className="text-[#F5F5F3]/40 text-xs mt-1.5 flex items-center gap-2">
          <span>Área: {userArea}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]/40" />
          <span>Rol: {profile?.role}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[2px] mb-8">
        <StatCard label="Casos Activos" value={activeCasesCount} icon={Briefcase} />
        <StatCard label="Tareas y Términos Pendientes" value={pendingTasksCount} icon={CheckSquare} />
        <StatCard label="Próximos Eventos" value={upcomingEvents.length} icon={Calendar} />
        <StatCard label="Miembros" value={members.length} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[2px]">
        <div className="bg-[#080808] border border-[#1A1A1A] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[#F5F5F3] text-sm font-heading tracking-wide">Casos Recientes</h2>
            <Link to="/casos" className="text-[#C9A227] text-[10px] tracking-wider uppercase flex items-center gap-1 hover:gap-2 transition-all">Ver todos <ArrowUpRight size={12} /></Link>
          </div>
          <div className="space-y-3">
            {recentCases.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 border-b border-[#1A1A1A] last:border-0">
                <div className="min-w-0">
                  <p className="text-[#F5F5F3] text-sm truncate">{c.title}</p>
                  <p className="text-[#F5F5F3]/30 text-[11px]">{c.case_number} · {c.client}</p>
                </div>
                <span className={`text-[10px] tracking-wider uppercase ${statusColors[c.status] || "text-[#F5F5F3]/30"}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#080808] border border-[#1A1A1A] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[#F5F5F3] text-sm font-heading tracking-wide">Tareas y Términos Próximos</h2>
            <Link to="/tareas" className="text-[#C9A227] text-[10px] tracking-wider uppercase flex items-center gap-1 hover:gap-2 transition-all">Ver todas <ArrowUpRight size={12} /></Link>
          </div>
          <div className="space-y-3">
            {upcomingTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 border-b border-[#1A1A1A] last:border-0">
                <div className="min-w-0 flex items-center gap-3">
                  <Clock size={14} className="text-[#F5F5F3]/20 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[#F5F5F3] text-sm truncate">{t.title}</p>
                    <p className="text-[#F5F5F3]/30 text-[11px]">{t.assigned_lawyer || "Sin asignar"}{t.due_date ? ` · ${new Date(t.due_date).toLocaleDateString("es")}` : ""}</p>
                  </div>
                </div>
                <span className={`text-[10px] tracking-wider uppercase ${priorityColors[t.urgency] || "text-[#F5F5F3]/30"}`}>{t.urgency}</span>
              </div>
            ))}
            {upcomingTasks.length === 0 && <p className="text-[#F5F5F3]/20 text-sm">Sin tareas pendientes</p>}
          </div>
        </div>
      </div>

      <div className="bg-[#080808] border border-[#1A1A1A] p-6 mt-[2px]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#F5F5F3] text-sm font-heading tracking-wide">Próximos Eventos</h2>
          <Link to="/calendario" className="text-[#C9A227] text-[10px] tracking-wider uppercase flex items-center gap-1 hover:gap-2 transition-all">Ver calendario <ArrowUpRight size={12} /></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
          {upcomingEvents.map((e) => (
            <div key={e.id} className="bg-[#0F0F0F] border border-[#1A1A1A] p-4">
              <p className="text-[#C9A227] text-[10px] tracking-wider uppercase mb-2">{e.event_type}</p>
              <p className="text-[#F5F5F3] text-sm">{e.title}</p>
              <p className="text-[#F5F5F3]/30 text-[11px] mt-2">{new Date(e.event_date).toLocaleDateString("es")}{e.event_time ? ` · ${e.event_time}` : ""}</p>
            </div>
          ))}
          {upcomingEvents.length === 0 && <p className="text-[#F5F5F3]/20 text-sm">Sin eventos próximos</p>}
        </div>
      </div>
    </div>
  );
}