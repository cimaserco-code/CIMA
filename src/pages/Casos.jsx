import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Briefcase, Calendar, Pencil, Trash2, Folder, Search, Eye, FileText, CheckSquare, Clock, ArrowUpRight, X, Download } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import LawyerSelect from "@/components/legal/LawyerSelect";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";
import { logActivity } from "@/lib/activityLogger";
import { createNotification } from "@/lib/notificationService";

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
  const navigate = useNavigate();
  const { user, profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [cases, setCases] = useState([]);
  const [members, setMembers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [dbClients, setDbClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPracticeArea, setFilterPracticeArea] = useState("all");
  const [filterAreaId, setFilterAreaId] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // States for Case Detail Modal
  const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
  const [caseDocs, setCaseDocs] = useState([]);
  const [caseTasks, setCaseTasks] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("documentos"); // 'documentos' | 'tareas' | 'general'

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

  const handleSelectCase = async (c) => {
    setSelectedCaseDetail(c);
    setDetailTab("documentos");
    setDetailLoading(true);
    try {
      const [dRes, tRes] = await Promise.all([
        supabase.from('documents').select('*').eq('case_id', c.id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('case_id', c.id).order('created_at', { ascending: false })
      ]);
      setCaseDocs(dRes.data || []);
      setCaseTasks(tRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Filter cases:
  // 1. Partition filter: If not admin, only show cases belonging to user's assigned area.
  // 2. Interactive filters: Filter by status, practice area, office area, and search keyword.
  const filtered = cases.filter((c) => {
    // Area partition restriction
    if (!isAdmin && c.area_id !== profile?.area_id) {
      return false;
    }

    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    const matchesPractice = filterPracticeArea === "all" || c.practice_area === filterPracticeArea;
    const matchesArea = filterAreaId === "all" || c.area_id === filterAreaId;

    if (!searchTerm.trim()) {
      return matchesStatus && matchesPractice && matchesArea;
    }

    const term = searchTerm.toLowerCase().trim();
    const title = (c.title || "").toLowerCase();
    const caseNum = (c.case_number || "").toLowerCase();
    const client = (c.client || "").toLowerCase();
    const practice = (c.practice_area || "").toLowerCase();
    const lawyersStr = Array.isArray(c.assigned_lawyers) ? c.assigned_lawyers.join(" ").toLowerCase() : "";

    const matchesSearch =
      title.includes(term) ||
      caseNum.includes(term) ||
      client.includes(term) ||
      practice.includes(term) ||
      lawyersStr.includes(term);

    return matchesStatus && matchesPractice && matchesArea && matchesSearch;
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
    if (!form.title.trim()) {
      alert("Por favor ingresa un título para el caso.");
      return;
    }
    if (!form.client_id) {
      alert("Por favor selecciona un cliente para el caso.");
      return;
    }
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

      let res;
      if (editingId) { 
        res = await supabase.from('cases').update(payload).eq('id', editingId); 
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "EDITAR",
            module: "Casos",
            description: `Actualizó el caso "${form.title}" (${form.case_number}) - Estado: ${form.status}`,
            metadata: { case_id: editingId, case_number: form.case_number, status: form.status }
          });
        }
      } else { 
        res = await supabase.from('cases').insert([payload]); 
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "CREAR",
            module: "Casos",
            description: `Creó el nuevo caso "${form.title}" (${form.case_number})`,
            metadata: { case_number: form.case_number, client: form.client, practice_area: form.practice_area }
          });
        }
      }
      
      if (res.error) throw res.error;
      
      // Notificar a los abogados asignados
      const assigned = toArray(form.assigned_lawyer);
      for (const lawyerName of assigned) {
        createNotification({
          recipientName: lawyerName,
          type: "caso",
          title: editingId ? "Caso actualizado" : "Nuevo caso asignado",
          message: `Te han asignado el caso "${form.title}" (${form.case_number})`,
          link: "/casos",
          metadata: { case_number: form.case_number, case_title: form.title }
        });
      }

      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { 
      console.error(e); 
      alert("Error al guardar el caso: " + (e.message || JSON.stringify(e)));
    } finally { 
      setSaving(false); 
    }
  };

  const remove = async (c) => {
    if (!confirm(`¿Eliminar el caso "${c.title}"?`)) return;
    try { 
      const res = await supabase.from('cases').delete().eq('id', c.id); 
      if (!res.error) {
        logActivity({
          userId: user?.id,
          userName: profile?.full_name || user?.email || "Usuario",
          userEmail: user?.email,
          action: "ELIMINAR",
          module: "Casos",
          description: `Eliminó el caso "${c.title}" (${c.case_number || 'sin folio'})`,
          metadata: { case_id: c.id, case_number: c.case_number }
        });
      }
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

  const activeCaseAreaId = form.area_id || (!isAdmin ? profile?.area_id : null);
  const eligibleMembersForCase = activeCaseAreaId
    ? members.filter((m) => m.area_id === activeCaseAreaId || !m.area_id || ['Admin', 'Direccion General'].includes(m.role))
    : members;

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

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F5F5F3]/20" />
          <input
            type="text"
            className="w-full bg-[#080808] border border-[#1A1A1A] pl-11 pr-8 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors"
            placeholder="Buscar por caso, no. expediente, cliente o abogado…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#F5F5F3]/30 hover:text-[#F5F5F3] p-1 text-xs transition-colors"
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
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
      </div>

      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando casos…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
          {filtered.map((c) => (
            <div 
              key={c.id} 
              onClick={() => handleSelectCase(c)}
              className="bg-[#080808] border border-[#1A1A1A] p-5 hover:border-[#C9A227]/40 hover:bg-[#0C0C0C] transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex gap-2">
                    <span className={`text-[9px] tracking-wider uppercase px-2 py-1 ${statusColors[c.status] || ""}`}>{c.status}</span>
                    <span className={`text-[9px] tracking-wider uppercase ${priorityColors[c.priority] || ""}`}>{c.priority}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {permissions?.can_edit_cases && (
                      <button onClick={() => openEdit(c)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors" title="Editar caso"><Pencil size={13} /></button>
                    )}
                    {permissions?.can_delete_cases && (
                      <button onClick={() => remove(c)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors" title="Eliminar caso"><Trash2 size={13} /></button>
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

              {/* Card Footer Callout */}
              <div className="mt-4 pt-3 border-t border-[#141414] flex items-center justify-between text-[10px] text-[#F5F5F3]/30 group-hover:text-[#C9A227] transition-colors">
                <span>Ver documentos y tareas</span>
                <ArrowUpRight size={13} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16">
              <Briefcase size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" />
              <p className="text-[#F5F5F3]/20 text-sm">
                {searchTerm ? "No se encontraron casos para esta búsqueda" : "Sin casos para estos filtros"}
              </p>
            </div>
          )}
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
          <div>
            <label className={labelCls}>
              Abogados asignados {activeCaseAreaId && <span className="text-[#C9A227] font-normal normal-case">({areas.find(a => a.id === activeCaseAreaId)?.name})</span>}
            </label>
            <LawyerSelect members={eligibleMembersForCase} selected={form.assigned_lawyer} onChange={(v) => setForm({ ...form, assigned_lawyer: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Prioridad</label><select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{cap(p)}</option>)}</select></div>
            <div><label className={labelCls}>Próx. audiencia</label><input type="date" className={inputCls} value={form.next_hearing} onChange={(e) => setForm({ ...form, next_hearing: e.target.value })} /></div>
          </div>
          <div><label className={labelCls}>Descripción</label><textarea className={inputCls} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del caso" /></div>
          <button onClick={submit} disabled={!form.title || !form.client_id || saving} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors">{saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Crear Caso"}</button>
        </div>
      </Modal>

      {/* Modal de Detalle de Caso (Documentos y Tareas relacionadas) */}
      <Modal 
        open={!!selectedCaseDetail} 
        onClose={() => setSelectedCaseDetail(null)} 
        title={`Expediente: ${selectedCaseDetail?.title || "Detalle del Caso"}`}
      >
        {selectedCaseDetail && (
          <div className="space-y-5 text-left">
            {/* Header info bar */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#C9A227] font-semibold">{selectedCaseDetail.case_number}</span>
                  <span className={`text-[9px] tracking-wider uppercase px-2 py-0.5 ${statusColors[selectedCaseDetail.status] || ""}`}>{selectedCaseDetail.status}</span>
                  <span className={`text-[9px] tracking-wider uppercase ${priorityColors[selectedCaseDetail.priority] || ""}`}>{selectedCaseDetail.priority}</span>
                </div>
                <p className="text-xs text-[#F5F5F3]/50 mt-1.5">
                  Cliente: <span className="text-[#F5F5F3] font-medium">{selectedCaseDetail.client}</span>
                  {selectedCaseDetail.practice_area ? ` · ${selectedCaseDetail.practice_area}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {permissions?.can_edit_cases && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedCaseDetail;
                      setSelectedCaseDetail(null);
                      openEdit(c);
                    }}
                    className="px-3 py-1.5 border border-[#1E1E1E] text-xs text-[#F5F5F3]/60 hover:text-[#C9A227] hover:border-[#C9A227]/40 flex items-center gap-1.5 transition-colors"
                  >
                    <Pencil size={12} />
                    <span>Editar Caso</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tabs inside modal */}
            <div className="flex border-b border-[#1A1A1A] gap-1">
              <button
                type="button"
                onClick={() => setDetailTab("documentos")}
                className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors border-b-2 ${
                  detailTab === "documentos"
                    ? "border-[#C9A227] text-[#C9A227] font-medium"
                    : "border-transparent text-[#F5F5F3]/40 hover:text-[#F5F5F3]"
                }`}
              >
                <FileText size={13} />
                <span>Documentos ({caseDocs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("tareas")}
                className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors border-b-2 ${
                  detailTab === "tareas"
                    ? "border-[#C9A227] text-[#C9A227] font-medium"
                    : "border-transparent text-[#F5F5F3]/40 hover:text-[#F5F5F3]"
                }`}
              >
                <CheckSquare size={13} />
                <span>Tareas ({caseTasks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("general")}
                className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors border-b-2 ${
                  detailTab === "general"
                    ? "border-[#C9A227] text-[#C9A227] font-medium"
                    : "border-transparent text-[#F5F5F3]/40 hover:text-[#F5F5F3]"
                }`}
              >
                <Briefcase size={13} />
                <span>Información General</span>
              </button>
            </div>

            {/* Tab: Documentos */}
            {detailTab === "documentos" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#F5F5F3]/40">Documentos vinculados a este caso:</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCaseDetail(null);
                      navigate("/documentos");
                    }}
                    className="text-xs text-[#C9A227] hover:underline flex items-center gap-1"
                  >
                    <span>Ir al módulo de Documentos</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>

                {detailLoading ? (
                  <p className="text-xs text-[#F5F5F3]/30 py-6 text-center">Cargando documentos…</p>
                ) : caseDocs.length === 0 ? (
                  <div className="p-8 text-center bg-[#0A0A0A] border border-[#161616]">
                    <FileText size={28} className="text-[#F5F5F3]/10 mx-auto mb-2" />
                    <p className="text-xs text-[#F5F5F3]/40">No hay documentos registrados en este caso aún.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#161616] border border-[#1A1A1A] bg-[#0A0A0A] max-h-72 overflow-y-auto">
                    {caseDocs.map((doc) => (
                      <div key={doc.id} className="p-3 flex items-center justify-between hover:bg-[#121212] transition-colors">
                        <div className="min-w-0 flex items-center gap-2.5">
                          <FileText size={15} className="text-[#C9A227] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-[#F5F5F3] font-medium truncate">{doc.title}</p>
                            <p className="text-[10px] text-[#F5F5F3]/30 truncate">
                              {doc.doc_type} {doc.lawyer ? `· Abogado: ${doc.lawyer}` : ""} {doc.file_name ? `· ${doc.file_name}` : ""}
                            </p>
                          </div>
                        </div>
                        {doc.file_url && (
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-[#F5F5F3]/40 hover:text-[#C9A227] transition-colors"
                              title="Ver documento"
                            >
                              <Eye size={14} />
                            </a>
                            <a
                              href={doc.file_url}
                              download={doc.file_name || doc.title}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-[#F5F5F3]/40 hover:text-[#C9A227] transition-colors"
                              title="Descargar archivo"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Tareas */}
            {detailTab === "tareas" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#F5F5F3]/40">Tareas y términos de este caso:</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCaseDetail(null);
                      navigate("/tareas");
                    }}
                    className="text-xs text-[#C9A227] hover:underline flex items-center gap-1"
                  >
                    <span>Ir al módulo de Tareas</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>

                {detailLoading ? (
                  <p className="text-xs text-[#F5F5F3]/30 py-6 text-center">Cargando tareas…</p>
                ) : caseTasks.length === 0 ? (
                  <div className="p-8 text-center bg-[#0A0A0A] border border-[#161616]">
                    <CheckSquare size={28} className="text-[#F5F5F3]/10 mx-auto mb-2" />
                    <p className="text-xs text-[#F5F5F3]/40">No hay tareas asignadas para este caso aún.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#161616] border border-[#1A1A1A] bg-[#0A0A0A] max-h-72 overflow-y-auto">
                    {caseTasks.map((t) => (
                      <div key={t.id} className="p-3 flex items-center justify-between hover:bg-[#121212] transition-colors">
                        <div className="min-w-0 flex items-center gap-2.5">
                          <CheckSquare size={15} className="text-[#C9A227] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-[#F5F5F3] font-medium truncate">{t.title}</p>
                            <p className="text-[10px] text-[#F5F5F3]/30 truncate">
                              Estado: <span className="uppercase text-[#F5F5F3]/60">{t.status}</span>
                              {t.assigned_lawyer ? ` · ${t.assigned_lawyer}` : ""}
                              {t.due_date ? ` · Límite: ${new Date(t.due_date).toLocaleDateString("es")}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 border border-[#1E1E1E] text-[#F5F5F3]/50">
                          {t.urgency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Información General */}
            {detailTab === "general" && (
              <div className="space-y-3 bg-[#0A0A0A] border border-[#1A1A1A] p-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-[#161616]">
                  <div>
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block">Área de Práctica</span>
                    <span className="text-[#F5F5F3] font-medium">{selectedCaseDetail.practice_area || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block">Oficina / Área</span>
                    <span className="text-[#F5F5F3] font-medium">{areas.find(a => a.id === selectedCaseDetail.area_id)?.name || "Sin Área Asignada"}</span>
                  </div>
                  <div>
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block">Abogado(s) Asignados</span>
                    <span className="text-[#F5F5F3] font-medium">{lawyers(selectedCaseDetail.assigned_lawyers)}</span>
                  </div>
                  <div>
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block">Próxima Audiencia</span>
                    <span className="text-[#F5F5F3] font-medium">
                      {selectedCaseDetail.next_hearing ? new Date(selectedCaseDetail.next_hearing).toLocaleDateString("es") : "Sin audiencia agendada"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block mb-1">Descripción y Notas del Caso</span>
                  <p className="text-[#F5F5F3]/70 leading-relaxed bg-[#0F0F0F] p-3 border border-[#161616] whitespace-pre-wrap">
                    {selectedCaseDetail.description || "Sin descripción registrada para este caso."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}