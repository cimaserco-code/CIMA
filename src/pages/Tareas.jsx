import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, CheckSquare, ChevronRight, Clock, Pencil, Trash2, MapPin, Search, UserCheck, Layers, LayoutGrid } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import LawyerSelect from "@/components/legal/LawyerSelect";
import CaseSelect from "@/components/legal/CaseSelect";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";
import { logActivity } from "@/lib/activityLogger";
import { createNotification } from "@/lib/notificationService";
import { toast } from "@/components/ui/use-toast";
import { isResourceInUserArea, filterMembersByArea } from "@/lib/areaPermissions";

const COLUMNS = [
  { key: "pendiente", label: "Por Hacer" },
  { key: "en_proceso", label: "En Progreso" },
  { key: "completada", label: "Completada" },
];
const NEXT_STATUS = { pendiente: "en_proceso", en_proceso: "completada", completada: "pendiente" };
const URGECIES = ["urgente", "alta", "media", "baja"];
const urgencyColors = { urgente: "text-red-500 border-red-500/30", alta: "text-red-400 border-red-400/30", media: "text-yellow-400 border-yellow-400/30", baja: "text-[#F5F5F3]/40 border-[#F5F5F3]/20" };

export const VENUES = [
  { key: "pacho_viejo", label: "Salas de Juicios Orales (Pacho Viejo)", shortLabel: "Pacho Viejo", badgeColor: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  { key: "fge", label: "Fiscalía General del Estado (FGE)", shortLabel: "FGE", badgeColor: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  { key: "pjev", label: "Tribunales Superiores de Justicia (PJEV)", shortLabel: "PJEV", badgeColor: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  { key: "pjf", label: "Poder Judicial de la Federación (PJF)", shortLabel: "PJF", badgeColor: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  { key: "oficina", label: "Oficinas CIMA / Gestión Interna", shortLabel: "Oficina CIMA", badgeColor: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10" },
  { key: "otra", label: "Otra Sede / Diligencia Foránea", shortLabel: "Otra Sede", badgeColor: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" }
];

const EMPTY = { title: "", description: "", case_id: "", assigned_lawyer: "", due_date: "", urgency: "media", status: "pendiente", task_type: "oficina" };

export default function Tareas() {
  const { user, profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [cases, setCases] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // New interactive filters:
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "sede"
  const [onlyMine, setOnlyMine] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCaseFilter, setSelectedCaseFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, mRes, cRes, aRes] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('team_members').select('*'),
        supabase.from('cases').select('*'),
        supabase.from('areas').select('*')
      ]);
      if (tRes.data) setTasks(tRes.data);
      if (mRes.data) setMembers(mRes.data);
      if (cRes.data) setCases(cRes.data);
      if (aRes.data) setAreas(aRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Partition cases and tasks strictly by Area:
  const visibleCases = cases.filter(c => isResourceInUserArea(c, profile, { cases, members }, permissions));
  const visibleTasks = tasks.filter(t => isResourceInUserArea(t, profile, { cases, members }, permissions));

  const advance = async (task) => {
    const newStatus = NEXT_STATUS[task.status] || "pendiente";
    try { 
      await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id); 
      load(); 
    } catch (e) { console.error(e); }
  };

  const openNew = () => { setEditingId(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (t) => {
    setEditingId(t.id);
    setForm({ 
      title: t.title || "", 
      description: t.description || "", 
      case_id: t.case_id || "", 
      assigned_lawyer: t.assigned_lawyer || "", 
      due_date: t.due_date || "", 
      urgency: t.urgency || "media", 
      status: t.status || "pendiente",
      task_type: t.task_type || "oficina"
    });
    setModalOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        case_id: form.case_id || null,
        assigned_lawyer: form.assigned_lawyer,
        due_date: form.due_date || null,
        urgency: form.urgency,
        status: form.status,
        task_type: form.task_type || "oficina"
      };

      let res;
      if (editingId) { 
        res = await supabase.from('tasks').update(payload).eq('id', editingId); 
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "EDITAR",
            module: "Tareas",
            description: `Actualizó la tarea "${form.title}" - Estado: ${form.status}`,
            metadata: { task_id: editingId, urgency: form.urgency }
          });
        }
      } else { 
        res = await supabase.from('tasks').insert([payload]); 
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "CREAR",
            module: "Tareas",
            description: `Creó la nueva tarea "${form.title}" (${form.urgency})`,
            metadata: { urgency: form.urgency, due_date: form.due_date }
          });
        }
      }

      if (res.error) throw res.error;

      // Disparar notificación de asignación
      if (form.assigned_lawyer) {
        const notifTitle = editingId ? "Tarea actualizada" : "Nueva tarea asignada";
        const notifMsg = `Te han asignado la tarea "${form.title}" (Urgencia: ${form.urgency})`;

        createNotification({
          recipientName: form.assigned_lawyer,
          type: "tarea",
          title: notifTitle,
          message: notifMsg,
          link: "/tareas",
          metadata: { task_title: form.title, urgency: form.urgency, due_date: form.due_date }
        });

        // Popup inmediato si el usuario autenticado es el asignado
        const userNameLower = (profile?.full_name || "").toLowerCase().trim();
        const userEmailLower = (user?.email || "").toLowerCase().trim();
        const lLower = form.assigned_lawyer.toLowerCase().trim();
        if ((userNameLower && lLower.includes(userNameLower)) || (userEmailLower && lLower.includes(userEmailLower))) {
          toast({
            title: notifTitle,
            description: notifMsg
          });
        }
      }

      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { 
      console.error(e); 
      alert("Error al guardar la tarea: " + (e.message || JSON.stringify(e)));
    }
    finally { setSaving(false); }
  };

  const remove = async (t) => {
    if (!confirm(`¿Eliminar la tarea "${t.title}"?`)) return;
    try { 
      const res = await supabase.from('tasks').delete().eq('id', t.id); 
      if (!res.error) {
        logActivity({
          userId: user?.id,
          userName: profile?.full_name || user?.email || "Usuario",
          userEmail: user?.email,
          action: "ELIMINAR",
          module: "Tareas",
          description: `Eliminó la tarea "${t.title}"`,
          metadata: { task_id: t.id }
        });
      }
      load(); 
    } catch (e) { console.error(e); }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  if (!permissions?.can_view_tasks) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#F5F5F3]/30">
        <CheckSquare size={40} className="mb-3 opacity-20" />
        <p className="text-sm font-medium">Acceso Denegado</p>
        <p className="text-xs opacity-50 mt-1">No tienes permisos para ver este módulo.</p>
      </div>
    );
  }

  const selectedCaseForTask = cases.find(c => c.id === form.case_id);
  const activeTaskAreaId = form.case_id
    ? selectedCaseForTask?.area_id
    : (!isAdmin ? profile?.area_id : null);
  const eligibleLawyersForTask = selectedCaseForTask && isAdmin
    ? filterMembersByArea(members, { area_id: selectedCaseForTask.area_id }, { can_view_all_cases: false })
    : filterMembersByArea(members, profile, permissions);

  // Apply search and personal filter
  const myName = (profile?.full_name || "").toLowerCase().trim();
  const myEmail = (user?.email || "").toLowerCase().trim();

  const filteredTasks = visibleTasks.filter((t) => {
    // Only mine filter
    if (onlyMine) {
      const assigned = (t.assigned_lawyer || "").toLowerCase().trim();
      if (!assigned) return false;
      const isMine = (myName && assigned.includes(myName)) || (myEmail && assigned.includes(myEmail));
      if (!isMine) return false;
    }

    // Case filter
    if (selectedCaseFilter !== "all" && t.case_id !== selectedCaseFilter) {
      return false;
    }

    // Search query
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const title = (t.title || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      const lawyer = (t.assigned_lawyer || "").toLowerCase();
      const caseObj = cases.find(c => c.id === t.case_id);
      const caseTitle = (caseObj?.title || "").toLowerCase();
      const caseNum = (caseObj?.case_number || "").toLowerCase();
      const venueObj = VENUES.find(v => v.key === t.task_type);
      const venueName = (venueObj?.label || "").toLowerCase();

      const match = title.includes(term) || desc.includes(term) || lawyer.includes(term) ||
                    caseTitle.includes(term) || caseNum.includes(term) || venueName.includes(term);
      if (!match) return false;
    }

    return true;
  });

  const getVenueObj = (venueKey) => VENUES.find(v => v.key === venueKey) || VENUES.find(v => v.key === "oficina");

  const renderTaskCard = (t) => {
    const caseObj = cases.find(c => c.id === t.case_id);
    const venueObj = getVenueObj(t.task_type);

    return (
      <div key={t.id} className="bg-[#0F0F0F] border border-[#1A1A1A] p-4 group hover:border-[#2A2A2A] transition-colors rounded-sm">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[#F5F5F3] text-sm flex-1 font-medium leading-snug">{t.title}</p>
          <div className="flex items-center gap-1">
            <span className={`text-[9px] tracking-wider uppercase px-1.5 py-0.5 border ${urgencyColors[t.urgency] || ""}`}>
              {t.urgency}
            </span>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {permissions?.can_edit_tasks && (
                <button onClick={() => openEdit(t)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors" title="Editar">
                  <Pencil size={11} />
                </button>
              )}
              {permissions?.can_delete_tasks && (
                <button onClick={() => remove(t)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors" title="Eliminar">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Venue Badge */}
        <div className="mb-2">
          <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 border rounded-sm font-medium ${venueObj.badgeColor}`}>
            <MapPin size={10} />
            {venueObj.shortLabel}
          </span>
        </div>

        {caseObj && (
          <div className="mb-2 text-[11px] text-[#C9A227]/90 truncate">
            <span className="font-medium">{caseObj.title}</span>
            <span className="text-[#F5F5F3]/30 ml-1 font-mono text-[10px]">({caseObj.case_number})</span>
          </div>
        )}

        {t.description && (
          <p className="text-[#F5F5F3]/40 text-[11px] mb-3 line-clamp-2 leading-relaxed">
            {t.description}
          </p>
        )}

        <div className="flex items-center justify-between text-[10px] text-[#F5F5F3]/40 pt-2 border-t border-[#161616]">
          <span className="truncate max-w-[140px] font-medium text-[#F5F5F3]/60">{t.assigned_lawyer || "Sin asignar"}</span>
          {t.due_date && (
            <span className="flex items-center gap-1 flex-shrink-0 text-amber-200/80">
              <Clock size={10} />{new Date(t.due_date).toLocaleDateString("es")}
            </span>
          )}
        </div>

        <button 
          onClick={() => advance(t)} 
          className="mt-3 w-full text-[10px] tracking-wider uppercase text-[#C9A227] flex items-center justify-center gap-1 py-1.5 bg-[#141414] hover:bg-[#C9A227]/10 border border-[#1E1E1E] transition-colors"
        >
          {t.status === "completada" ? "Reabrir Tarea" : `Avanzar a ${NEXT_STATUS[t.status] === "en_proceso" ? "En Progreso" : "Completada"}`} 
          <ChevronRight size={12} />
        </button>
      </div>
    );
  };

  return (
    <div>
      <PageHeader 
        title="Tareas y Logística de Diligencias" 
        subtitle={`${filteredTasks.filter((t) => t.status !== "completada").length} tareas pendientes`} 
        action={
          permissions?.can_create_tasks && (
            <button onClick={openNew} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
              <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
              <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2">
                <Plus size={15} /> Nueva Tarea/Diligencia
              </span>
            </button>
          )
        } 
      />

      {/* Control Bar: Filters, Search, View Modes */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-[#080808] border border-[#1A1A1A] p-3">
        {/* Left: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F5F5F3]/30" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por tarea, caso, abogado o sede…"
              className="w-full bg-[#0F0F0F] border border-[#1A1A1A] pl-9 pr-3 py-1.5 text-xs text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyMine(!onlyMine)}
            className={`px-3 py-1.5 text-xs tracking-wider flex items-center gap-1.5 border transition-colors ${
              onlyMine 
                ? "bg-[#C9A227] text-[#080808] border-[#C9A227] font-semibold" 
                : "bg-[#0F0F0F] text-[#F5F5F3]/60 border-[#1A1A1A] hover:text-[#F5F5F3]"
            }`}
          >
            <UserCheck size={13} />
            <span>Mis Tareas</span>
          </button>

          <select
            value={selectedCaseFilter}
            onChange={(e) => setSelectedCaseFilter(e.target.value)}
            className="bg-[#0F0F0F] border border-[#1A1A1A] text-xs text-[#F5F5F3]/70 px-3 py-1.5 focus:outline-none focus:border-[#C9A227] max-w-[200px] truncate"
          >
            <option value="all">Todos los casos</option>
            {visibleCases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Right: View Mode Toggle */}
        <div className="flex items-center bg-[#0F0F0F] border border-[#1A1A1A] p-0.5 rounded-sm">
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={`px-3 py-1 text-xs flex items-center gap-1.5 transition-colors ${
              viewMode === "kanban" 
                ? "bg-[#C9A227] text-[#080808] font-semibold" 
                : "text-[#F5F5F3]/50 hover:text-[#F5F5F3]"
            }`}
          >
            <LayoutGrid size={13} />
            <span>Por Estado</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("sede")}
            className={`px-3 py-1 text-xs flex items-center gap-1.5 transition-colors ${
              viewMode === "sede" 
                ? "bg-[#C9A227] text-[#080808] font-semibold" 
                : "text-[#F5F5F3]/50 hover:text-[#F5F5F3]"
            }`}
            title="Agrupar tareas por sede o juzgado para coordinar vueltas"
          >
            <MapPin size={13} />
            <span>Agrupar por Sede (Rutas)</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[#F5F5F3]/30 text-sm">Cargando tareas y términos…</p>
      ) : viewMode === "kanban" ? (
        /* KANBAN BY STATUS */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[2px]">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="bg-[#080808] border border-[#1A1A1A] min-h-[420px] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A]">
                  <h3 className="text-[#F5F5F3]/60 text-xs tracking-wider uppercase font-semibold">{col.label}</h3>
                  <span className="text-[#C9A227] text-xs font-mono">{colTasks.length}</span>
                </div>
                <div className="p-3 space-y-2.5 flex-1">
                  {colTasks.map(renderTaskCard)}
                  {colTasks.length === 0 && (
                    <div className="text-center py-12">
                      <CheckSquare size={20} className="text-[#F5F5F3]/10 mx-auto mb-2" />
                      <p className="text-[11px] text-[#F5F5F3]/20">Sin tareas en esta columna</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VENUE LOGISTICS GROUPING VIEW */
        <div className="space-y-4">
          <div className="p-3 bg-[#0A0A0A] border border-[#1E1E1E] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-[#C9A227]" />
              <p className="text-xs text-[#F5F5F3]/80">
                <span className="font-semibold text-[#F5F5F3]">Coordinación de Logística y Vueltas:</span> Tareas agrupadas por tribunal o fiscalía para atender varios asuntos en el mismo destino.
              </p>
            </div>
            <span className="text-[10px] text-[#F5F5F3]/40">{filteredTasks.length} tareas totales</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {VENUES.map((venue) => {
              const venueTasks = filteredTasks.filter((t) => (t.task_type || "oficina") === venue.key);
              const pendingCount = venueTasks.filter(t => t.status !== "completada").length;

              return (
                <div key={venue.key} className="bg-[#080808] border border-[#1A1A1A] flex flex-col min-h-[280px]">
                  {/* Venue Header */}
                  <div className="p-3.5 border-b border-[#1A1A1A] bg-[#0A0A0A] flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin size={14} className="text-[#C9A227] flex-shrink-0" />
                      <h3 className="text-xs text-[#F5F5F3] font-semibold truncate" title={venue.label}>
                        {venue.label}
                      </h3>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                      pendingCount > 0 ? "bg-[#C9A227]/20 text-[#C9A227]" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {pendingCount} pend.
                    </span>
                  </div>

                  {/* Tasks List for Venue */}
                  <div className="p-3 space-y-2.5 flex-1">
                    {venueTasks.map(renderTaskCard)}
                    {venueTasks.length === 0 && (
                      <div className="text-center py-10">
                        <p className="text-xs text-[#F5F5F3]/20">No hay tareas programadas para esta sede</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Tarea */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar Tarea / Diligencia" : "Nueva Tarea / Diligencia"}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Título de la Tarea</label>
            <input 
              className={inputCls} 
              value={form.title} 
              onChange={(e) => setForm({ ...form, title: e.target.value })} 
              placeholder="Ej. Asistir a audiencia intermedia / Recoger copias" 
            />
          </div>

          <div>
            <label className={labelCls}>Sede / Destino de Diligencia (Logística)</label>
            <select
              className={inputCls}
              value={form.task_type || "oficina"}
              onChange={(e) => setForm({ ...form, task_type: e.target.value })}
            >
              {VENUES.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-[#F5F5F3]/40 mt-1">
              Agrupa los asuntos para coordinar vueltas a juzgados o fiscalías.
            </p>
          </div>

          <div>
            <label className={labelCls}>Descripción o Instrucciones</label>
            <textarea 
              className={inputCls} 
              rows={2} 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              placeholder="Detalles sobre lo que se debe desahogar en la diligencia…" 
            />
          </div>

          <div>
            <label className={labelCls}>Caso Vinculado</label>
            <select className={inputCls} value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })}>
              <option value="">Seleccionar caso (opcional)...</option>
              {visibleCases.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>
              Abogado asignado {activeTaskAreaId && <span className="text-[#C9A227] font-normal normal-case">({areas.find(a => a.id === activeTaskAreaId)?.name})</span>}
            </label>
            <select className={inputCls} value={form.assigned_lawyer} onChange={(e) => setForm({ ...form, assigned_lawyer: e.target.value })}>
              <option value="">Seleccionar abogado...</option>
              {eligibleLawyersForTask.map((m) => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha Límite</label>
              <input type="date" className={inputCls} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Urgencia</label>
              <select className={inputCls} value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                {URGECIES.map((p) => <option key={p} value={p}>{cap(p)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Estado</label>
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <button 
            onClick={submit} 
            disabled={!form.title || saving} 
            className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors font-medium"
          >
            {saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Crear Tarea / Diligencia"}
          </button>
        </div>
      </Modal>
    </div>
  );
}