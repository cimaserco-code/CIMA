import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, CheckSquare, ChevronRight, Clock, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import LawyerSelect from "@/components/legal/LawyerSelect";
import CaseSelect from "@/components/legal/CaseSelect";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";

const COLUMNS = [
  { key: "pendiente", label: "Por Hacer" },
  { key: "en_proceso", label: "En Progreso" },
  { key: "completada", label: "Completada" },
];
const NEXT_STATUS = { pendiente: "en_proceso", en_proceso: "completada", completada: "pendiente" };
const URGECIES = ["urgente", "alta", "media", "baja"];
const urgencyColors = { urgente: "text-red-500 border-red-500/30", alta: "text-red-400 border-red-400/30", media: "text-yellow-400 border-yellow-400/30", baja: "text-[#F5F5F3]/40 border-[#F5F5F3]/20" };

const EMPTY = { title: "", description: "", case_id: "", assigned_lawyer: "", due_date: "", urgency: "media", status: "pendiente" };

export default function Tareas() {
  const { profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, mRes, cRes] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('team_members').select('*'),
        supabase.from('cases').select('*')
      ]);
      if (tRes.data) setTasks(tRes.data);
      if (mRes.data) setMembers(mRes.data);
      if (cRes.data) setCases(cRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Partition cases and tasks by Area:
  // If not admin, only show cases belonging to user's assigned area.
  // And only show tasks associated with those visible cases (or tasks with no case, or tasks assigned to that user).
  const visibleCases = cases.filter(c => isAdmin || c.area_id === profile?.area_id);
  const visibleTasks = tasks.filter(t => !t.case_id || visibleCases.some(c => c.id === t.case_id));

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
      status: t.status || "pendiente" 
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
        status: form.status
      };

      if (editingId) { 
        await supabase.from('tasks').update(payload).eq('id', editingId); 
      } else { 
        await supabase.from('tasks').insert([payload]); 
      }
      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const remove = async (t) => {
    if (!confirm(`¿Eliminar la tarea "${t.title}"?`)) return;
    try { 
      await supabase.from('tasks').delete().eq('id', t.id); 
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

  return (
    <div>
      <PageHeader title="Tareas y Términos" subtitle={`${visibleTasks.filter((t) => t.status !== "completada").length} pendientes`} action={
        permissions?.can_create_tasks && (
          <button onClick={openNew} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
            <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2"><Plus size={15} /> Nuevo Tarea/Término</span>
          </button>
        )
      } />

      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando tareas y términos…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[2px]">
          {COLUMNS.map((col) => {
            const colTasks = visibleTasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="bg-[#080808] border border-[#1A1A1A] min-h-[400px] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A]">
                  <h3 className="text-[#F5F5F3]/60 text-xs tracking-wider uppercase">{col.label}</h3>
                  <span className="text-[#F5F5F3]/20 text-xs">{colTasks.length}</span>
                </div>
                <div className="p-3 space-y-2 flex-1">
                  {colTasks.map((t) => (
                    <div key={t.id} className="bg-[#0F0F0F] border border-[#1A1A1A] p-4 group hover:border-[#2A2A2A] transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[#F5F5F3] text-sm flex-1">{t.title}</p>
                        <div className="flex gap-1">
                          <span className={`text-[9px] tracking-wider uppercase px-1.5 py-0.5 border ${urgencyColors[t.urgency] || ""}`}>{t.urgency}</span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {permissions?.can_edit_tasks && (
                              <button onClick={() => openEdit(t)} className="p-0.5 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"><Pencil size={11} /></button>
                            )}
                            {permissions?.can_delete_tasks && (
                              <button onClick={() => remove(t)} className="p-0.5 text-[#F5F5F3]/30 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                            )}
                          </div>
                        </div>
                      </div>
                      {t.description && <p className="text-[#F5F5F3]/30 text-[11px] mb-3 line-clamp-2">{t.description}</p>}
                      <div className="flex items-center justify-between text-[10px] text-[#F5F5F3]/30">
                        <span className="truncate">{t.assigned_lawyer || "Sin asignar"}</span>
                        {t.due_date && <span className="flex items-center gap-1 flex-shrink-0"><Clock size={10} />{new Date(t.due_date).toLocaleDateString("es")}</span>}
                      </div>
                      <button onClick={() => advance(t)} className="mt-3 w-full text-[10px] tracking-wider uppercase text-[#C9A227] flex items-center justify-center gap-1 py-1.5 hover:bg-[#C9A227]/5 transition-colors">
                        {t.status === "completada" ? "Reabrir" : "Avanzar"} <ChevronRight size={12} />
                      </button>
                    </div>
                  ))}
                  {colTasks.length === 0 && <div className="text-center py-8"><CheckSquare size={20} className="text-[#F5F5F3]/10 mx-auto" /></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar Tarea/Término" : "Nuevo Tarea/Término"}>
        <div className="space-y-4">
          <div><label className={labelCls}>Título</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nombre de la tarea o término" /></div>
          <div><label className={labelCls}>Descripción</label><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" /></div>
          <div>
            <label className={labelCls}>Caso Vinculado</label>
            <select className={inputCls} value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })}>
              <option value="">Seleccionar caso...</option>
              {visibleCases.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Abogado asignado</label>
            <select className={inputCls} value={form.assigned_lawyer} onChange={(e) => setForm({ ...form, assigned_lawyer: e.target.value })}>
              <option value="">Seleccionar abogado...</option>
              {members.map((m) => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Vencimiento</label><input type="date" className={inputCls} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><label className={labelCls}>Urgencia</label><select className={inputCls} value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>{URGECIES.map((p) => <option key={p} value={p}>{cap(p)}</option>)}</select></div>
          </div>
          <div><label className={labelCls}>Estado</label><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
          <button onClick={submit} disabled={!form.title || saving} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors">{saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Crear Tarea/Término"}</button>
        </div>
      </Modal>
    </div>
  );
}