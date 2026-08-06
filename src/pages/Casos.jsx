import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Briefcase, Calendar, Pencil, Trash2, Folder } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import LawyerSelect from "@/components/legal/LawyerSelect";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";

const PRACTICE_AREAS = ["Litigio", "Corporativo", "M&A", "Propiedad Intelectual", "Regulatorio", "Arbitraje", "Fiscal", "Laboral"];
const STATUSES = ["activo", "en_proceso", "en_espera", "cerrado", "archivado"];
const PRIORITIES = ["alta", "media", "baja"];

const statusColors = { activo: "text-[#C9A227] bg-[#C9A227]/10", en_proceso: "text-yellow-400 bg-yellow-400/10", en_espera: "text-[#F5F5F3]/40 bg-[#F5F5F3]/5", cerrado: "text-green-400 bg-green-400/10", archivado: "text-[#F5F5F3]/20 bg-[#F5F5F3]/5" };
const priorityColors = { alta: "text-red-400", media: "text-yellow-400", baja: "text-[#F5F5F3]/40" };

const genCaseNumber = () => {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `CMA-${d}-${Math.floor(Math.random() * 1000)}`;
};

const EMPTY = { title: "", case_number: "", client: "", client_id: "", practice_area: "Litigio", status: "activo", priority: "media", assigned_lawyer: [], next_hearing: "", description: "", area_id: "" };

const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
const lawyers = (v) => Array.isArray(v) ? (v.length ? v.join(", ") : "—") : (v || "—");

export default function Casos() {
  const { profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [cases, setCases] = useState([]);
  const [members, setMembers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [dbClients, setDbClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPracticeArea, setFilterPracticeArea] = useState("all");
  const [filterAreaId, setFilterAreaId] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, mRes, aRes, clRes] = await Promise.all([
        supabase.from('cases').select('*').order('created_at', { ascending: false }),
        supabase.from('team_members').select('*'),
        supabase.from('areas').select('*').order('name'),
        supabase.from('clients').select('*').order('full_name')
      ]);
      if (cRes.data) setCases(cRes.data);
      if (mRes.data) setMembers(mRes.data);
      if (aRes.data) setAreas(aRes.data);
      if (clRes.data) setDbClients(clRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filter cases:
  // 1. Partition filter: If not admin, only show cases belonging to user's assigned area.
  // 2. Interactive filters: Filter by status, practice area, and office area.
  const filtered = cases.filter((c) => {
    // Area partition restriction
    if (!isAdmin && c.area_id !== profile?.area_id) {
      return false;
    }

    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    const matchesPractice = filterPracticeArea === "all" || c.practice_area === filterPracticeArea;
    const matchesArea = filterAreaId === "all" || c.area_id === filterAreaId;
    return matchesStatus && matchesPractice && matchesArea;
  });

  // Filter clients list for dropdown based on Area partitioning
  const visibleClientsDropdown = dbClients.filter(c => isAdmin || c.area_id === profile?.area_id);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY, case_number: genCaseNumber(), area_id: profile?.area_id || "" });
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      title: c.title,
      case_number: c.case_number,
      client: c.client || "",
      client_id: c.client_id || "",
      practice_area: c.practice_area || "Litigio",
      status: c.status || "activo",
      priority: c.priority || "media",
      assigned_lawyer: toArray(c.assigned_lawyers),
      next_hearing: c.next_hearing || "",
      description: c.description || "",
      area_id: c.area_id || ""
    });
    setModalOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        case_number: form.case_number,
        client: form.client,
        client_id: form.client_id || null,
        practice_area: form.practice_area,
        status: form.status,
        priority: form.priority,
        assigned_lawyers: toArray(form.assigned_lawyer),
        next_hearing: form.next_hearing || null,
        description: form.description,
        area_id: form.area_id || null
      };

      if (editingId) { 
        await supabase.from('cases').update(payload).eq('id', editingId); 
      } else { 
        await supabase.from('cases').insert([payload]); 
      }
      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!confirm(`¿Eliminar el caso "${c.title}"?`)) return;
    try { 
      await supabase.from('cases').delete().eq('id', c.id); 
      load(); 
    } catch (e) { console.error(e); }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  if (!permissions?.can_view_cases) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#F5F5F3]/30">
        <Briefcase size={40} className="mb-3 opacity-20" />
        <p className="text-sm font-medium">Acceso Denegado</p>
        <p className="text-xs opacity-50 mt-1">No tienes permisos para ver este módulo.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Casos" subtitle={`${filtered.length} casos visibles`} action={
        permissions?.can_create_cases && (
          <button onClick={openNew} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
            <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2"><Plus size={15} /> Nuevo Caso</span>
          </button>
        )
      } />

      <div className="flex flex-wrap gap-2 mb-6">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
          <option value="all">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        <select value={filterPracticeArea} onChange={(e) => setFilterPracticeArea(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
          <option value="all">Todas las prácticas</option>
          {PRACTICE_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {isAdmin && (
          <select value={filterAreaId} onChange={(e) => setFilterAreaId(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#C9A227] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
            <option value="all">Todas las áreas (Oficinas)</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando casos…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
          {filtered.map((c) => (
            <div key={c.id} className="bg-[#080808] border border-[#1A1A1A] p-5 hover:border-[#2A2A2A] transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-2">
                  <span className={`text-[9px] tracking-wider uppercase px-2 py-1 ${statusColors[c.status] || ""}`}>{c.status}</span>
                  <span className={`text-[9px] tracking-wider uppercase ${priorityColors[c.priority] || ""}`}>{c.priority}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {permissions?.can_edit_cases && (
                    <button onClick={() => openEdit(c)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"><Pencil size={13} /></button>
                  )}
                  {permissions?.can_delete_cases && (
                    <button onClick={() => remove(c)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              <p className="text-[#F5F5F3] text-sm font-medium mb-2 group-hover:text-[#C9A227] transition-colors">{c.title}</p>
              <p className="text-[#F5F5F3]/30 text-[11px] font-mono mb-3">{c.case_number}</p>
              <div className="space-y-1.5 text-[11px] text-[#F5F5F3]/40">
                <p><span className="text-[#F5F5F3]/20">Cliente:</span> {c.client}</p>
                <p><span className="text-[#F5F5F3]/20">Práctica:</span> {c.practice_area}</p>
                <p><span className="text-[#F5F5F3]/20">Área:</span> {areas.find(a => a.id === c.area_id)?.name || <span className="text-[#F5F5F3]/10 italic">Sin Área</span>}</p>
                <p><span className="text-[#F5F5F3]/20">Abogado(s):</span> {lawyers(c.assigned_lawyers)}</p>
                {c.next_hearing && <p className="flex items-center gap-1.5"><Calendar size={11} /> {new Date(c.next_hearing).toLocaleDateString("es")}</p>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-16"><Briefcase size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" /><p className="text-[#F5F5F3]/20 text-sm">Sin casos para estos filtros</p></div>}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar Caso" : "Nuevo Caso"}>
        <div className="space-y-4">
          <div><label className={labelCls}>Título</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nombre del caso" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>No. de Expediente</label><input readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} value={form.case_number} /></div>
            <div>
              <label className={labelCls}>Cliente</label>
              <select 
                className={inputCls} 
                value={form.client_id || ""} 
                onChange={(e) => {
                  const cl = dbClients.find(c => c.id === e.target.value);
                  setForm({ ...form, client_id: e.target.value, client: cl ? cl.full_name : "" });
                }}
                required
              >
                <option value="">Seleccionar cliente...</option>
                {visibleClientsDropdown.map(cl => (
                  <option key={cl.id} value={cl.id}>{cl.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Práctica</label><select className={inputCls} value={form.practice_area} onChange={(e) => setForm({ ...form, practice_area: e.target.value })}>{PRACTICE_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
            <div><label className={labelCls}>Estado</label><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</select></div>
          </div>
          <div>
            <label className={labelCls}>Área (Oficina/División)</label>
            <select 
              className={inputCls} 
              value={form.area_id} 
              onChange={(e) => setForm({ ...form, area_id: e.target.value })}
              disabled={!isAdmin}
            >
              <option value="">Sin Área Asignada</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Abogados asignados</label><LawyerSelect members={members} selected={form.assigned_lawyer} onChange={(v) => setForm({ ...form, assigned_lawyer: v })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Prioridad</label><select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{cap(p)}</option>)}</select></div>
            <div><label className={labelCls}>Próx. audiencia</label><input type="date" className={inputCls} value={form.next_hearing} onChange={(e) => setForm({ ...form, next_hearing: e.target.value })} /></div>
          </div>
          <div><label className={labelCls}>Descripción</label><textarea className={inputCls} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del caso" /></div>
          <button onClick={submit} disabled={!form.title || !form.client_id || saving} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors">{saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Crear Caso"}</button>
        </div>
      </Modal>
    </div>
  );
}