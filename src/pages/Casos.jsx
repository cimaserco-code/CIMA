import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Briefcase, Calendar, Pencil, Trash2, Folder, Search, Eye, FileText, CheckSquare, Clock, ArrowUpRight, X, Download, ExternalLink } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import LawyerSelect from "@/components/legal/LawyerSelect";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";
import { logActivity } from "@/lib/activityLogger";
import { createNotification } from "@/lib/notificationService";
import { toast } from "@/components/ui/use-toast";
import { filterMembersByArea } from "@/lib/areaPermissions";

const PRACTICE_AREAS = ["Penal", "Litigio", "Corporativo", "M&A", "Propiedad Intelectual", "Regulatorio", "Arbitraje", "Fiscal", "Laboral"];
const STATUSES = ["activo", "en_proceso", "en_espera", "cerrado", "archivado"];
const PRIORITIES = ["alta", "media", "baja"];

const statusColors = { activo: "text-[#C9A227] bg-[#C9A227]/10", en_proceso: "text-yellow-400 bg-yellow-400/10", en_espera: "text-[#F5F5F3]/40 bg-[#F5F5F3]/5", cerrado: "text-green-400 bg-green-400/10", archivado: "text-[#F5F5F3]/20 bg-[#F5F5F3]/5" };
const priorityColors = { alta: "text-red-400", media: "text-yellow-400", baja: "text-[#F5F5F3]/40" };

export const EMPTY_CNPP = {
  active: false,
  calidad: "victima", // 'victima' | 'imputado'
  delito: "",
  carpeta_investigacion: "",
  determinacion: "tramite", // 'tramite' | 'abstenerse' | 'neap' | 'at' | 'eap'
  impugno_258: "no", // 'si' | 'no'
  fecha_impugnacion: "",
  masc_investigacion: "no", // 'si' | 'no'
  masc_numero_acuerdo: "",
  masc_fecha_inicio: "",
  masc_fecha_termino: "",
  masc_condiciones: ""
};

export const DETERMINACION_LABELS = {
  tramite: "En trámite / Investigación inicial",
  abstenerse: "Abstenerse de investigar",
  neap: "No Ejercicio de la Acción Penal (NEAP)",
  at: "Archivo Temporal (AT)",
  eap: "Ejercicio de la Acción Penal (EAP)"
};

export function parseCnppData(description) {
  if (!description || typeof description !== "string") return { ...EMPTY_CNPP };
  const match = description.match(/<!--\s*cnpp_investigation:([\s\S]*?)\s*-->/i);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      return { ...EMPTY_CNPP, ...parsed, active: true };
    } catch (e) {
      console.error("Error parsing CNPP investigation data:", e);
    }
  }
  return { ...EMPTY_CNPP };
}

export function cleanCaseDescription(description) {
  if (!description || typeof description !== "string") return "";
  return description
    .replace(/<!--\s*cnpp_investigation:[\s\S]*?-->\s*/gi, "")
    .trim();
}

export function injectCnppData(description, cnppData) {
  const clean = cleanCaseDescription(description);
  if (!cnppData || (!cnppData.active && !cnppData.carpeta_investigacion && !cnppData.delito)) {
    return clean;
  }
  const payload = JSON.stringify(cnppData);
  return `<!-- cnpp_investigation:${payload} -->\n${clean}`.trim();
}

const genCaseNumber = () => {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `CMA-${d}-${Math.floor(Math.random() * 1000)}`;
};

const EMPTY = { 
  title: "", 
  case_number: "", 
  client: "", 
  client_id: "", 
  practice_area: "Litigio", 
  status: "activo", 
  priority: "media", 
  assigned_lawyer: [], 
  next_hearing: "", 
  description: "", 
  area_id: "",
  cnpp: { ...EMPTY_CNPP }
};

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
    const userArea = areas.find(a => a.id === profile?.area_id);
    const isPenal = (userArea?.name || "").toLowerCase() === "penal";
    setForm({ 
      ...EMPTY, 
      case_number: genCaseNumber(), 
      area_id: profile?.area_id || "",
      practice_area: isPenal ? "Penal" : "Litigio",
      cnpp: { ...EMPTY_CNPP, active: isPenal }
    });
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    const parsedCnpp = parseCnppData(c.description);
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
      description: cleanCaseDescription(c.description),
      area_id: c.area_id || "",
      cnpp: parsedCnpp
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
      const finalDesc = injectCnppData(form.description, form.cnpp);
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
        description: finalDesc,
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
        res = await supabase.from('cases').insert([payload]).select(); 
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

          // Notificar y ofrecer enlace directo al apartado del nuevo caso en Documentos
          const createdCase = res.data && res.data[0] ? res.data[0] : null;
          if (createdCase) {
            toast({
              title: "Apartado de Documentos creado",
              description: `Se ha habilitado el apartado para "${form.title}" en Documentos.`,
              action: (
                <button
                  type="button"
                  onClick={() => navigate(`/documentos?caseId=${createdCase.id}&upload=true`)}
                  className="text-[11px] bg-[#C9A227] text-[#080808] font-bold px-2 py-1 rounded hover:bg-[#A8841D] transition-colors"
                >
                  Subir Docs
                </button>
              )
            });
          }
        }
      }
      
      if (res.error) throw res.error;
      
      // Notificar a los abogados asignados
      const assigned = toArray(form.assigned_lawyer);
      const userNameLower = (profile?.full_name || "").toLowerCase().trim();
      const userEmailLower = (user?.email || "").toLowerCase().trim();

      for (const lawyerName of assigned) {
        const notifTitle = editingId ? "Caso actualizado" : "Nuevo caso asignado";
        const notifMsg = `Te han asignado el caso "${form.title}" (${form.case_number})`;

        createNotification({
          recipientName: lawyerName,
          type: "caso",
          title: notifTitle,
          message: notifMsg,
          link: "/casos",
          metadata: { case_number: form.case_number, case_title: form.title }
        });

        // Popup inmediato si el usuario autenticado es uno de los asignados
        const lLower = String(lawyerName).toLowerCase().trim();
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
  const eligibleMembersForCase = activeCaseAreaId && isAdmin
    ? filterMembersByArea(members, { area_id: activeCaseAreaId }, { can_view_all_cases: false })
    : filterMembersByArea(members, profile, permissions);

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
          <div><label className={labelCls}>Descripción</label><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del caso" /></div>

          {/* Sección Fase de Investigación Penal / CNPP */}
          <div className="border border-[#222] bg-[#0A0A0A] p-4 space-y-4 rounded-sm">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C9A227]" />
                <span className="text-xs uppercase tracking-wider font-semibold text-[#F5F5F3]">
                  Fase de Investigación / Carpeta Penal (CNPP)
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#F5F5F3]/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.cnpp?.active}
                  onChange={(e) => setForm({ ...form, cnpp: { ...form.cnpp, active: e.target.checked } })}
                  className="accent-[#C9A227] w-4 h-4 cursor-pointer"
                />
                <span>Habilitar datos de Carpeta</span>
              </label>
            </div>

            {form.cnpp?.active && (
              <div className="space-y-4 pt-1 text-xs">
                {/* 1. Víctima o Imputado */}
                <div>
                  <label className={labelCls}>Calidad Procesal / Sujeto</label>
                  <div className="flex items-center gap-6 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[#F5F5F3]">
                      <input
                        type="radio"
                        name="cnpp_calidad"
                        value="victima"
                        checked={form.cnpp.calidad === "victima"}
                        onChange={() => setForm({ ...form, cnpp: { ...form.cnpp, calidad: "victima" } })}
                        className="accent-[#C9A227] w-4 h-4"
                      />
                      <span>Víctima / Ofendido</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[#F5F5F3]">
                      <input
                        type="radio"
                        name="cnpp_calidad"
                        value="imputado"
                        checked={form.cnpp.calidad === "imputado"}
                        onChange={() => setForm({ ...form, cnpp: { ...form.cnpp, calidad: "imputado" } })}
                        className="accent-[#C9A227] w-4 h-4"
                      />
                      <span>Imputado / Investigado</span>
                    </label>
                  </div>
                </div>

                {/* 2. Delito y 3. No. Carpeta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Delito (Ej. Despojo)</label>
                    <input
                      className={inputCls}
                      value={form.cnpp.delito}
                      onChange={(e) => setForm({ ...form, cnpp: { ...form.cnpp, delito: e.target.value } })}
                      placeholder="Ej. Despojo, Fraude, Homicidio"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Número de Carpeta de Investigación</label>
                    <input
                      className={inputCls}
                      value={form.cnpp.carpeta_investigacion}
                      onChange={(e) => setForm({ ...form, cnpp: { ...form.cnpp, carpeta_investigacion: e.target.value } })}
                      placeholder="Ej. XAL/DXI/F3°/12345/2026"
                    />
                  </div>
                </div>

                {/* 4. Determinación de Carpeta */}
                <div className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] space-y-2">
                  <label className={labelCls}>Determinación de Carpeta de Investigación</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {Object.entries(DETERMINACION_LABELS).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 cursor-pointer p-2 bg-[#0A0A0A] border border-[#161616] hover:border-[#222] transition-colors rounded-sm">
                        <input
                          type="radio"
                          name="cnpp_determinacion"
                          value={k}
                          checked={form.cnpp.determinacion === k}
                          onChange={() => setForm({ ...form, cnpp: { ...form.cnpp, determinacion: k } })}
                          className="accent-[#C9A227] w-4 h-4"
                        />
                        <span className="text-[#F5F5F3]/90 text-[11px]">{label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Impugnación Recurso Art. 258 CNPP */}
                  <div className="mt-3 pt-3 border-t border-[#161616] space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-[#F5F5F3]/80">
                        ¿Se impugnó determinación mediante Recurso innominado (Artículo 258 CNPP)?
                      </span>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#F5F5F3]">
                          <input
                            type="radio"
                            name="cnpp_impugno_258"
                            value="si"
                            checked={form.cnpp.impugno_258 === "si"}
                            onChange={() => setForm({ ...form, cnpp: { ...form.cnpp, impugno_258: "si" } })}
                            className="accent-[#C9A227] w-3.5 h-3.5"
                          />
                          <span>SÍ</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#F5F5F3]">
                          <input
                            type="radio"
                            name="cnpp_impugno_258"
                            value="no"
                            checked={form.cnpp.impugno_258 === "no"}
                            onChange={() => setForm({ ...form, cnpp: { ...form.cnpp, impugno_258: "no" } })}
                            className="accent-[#C9A227] w-3.5 h-3.5"
                          />
                          <span>NO</span>
                        </label>
                      </div>
                    </div>

                    {form.cnpp.impugno_258 === "si" && (
                      <div className="pt-2">
                        <label className={labelCls}>Fecha de Impugnación (Art. 258 CNPP)</label>
                        <input
                          type="date"
                          className={inputCls}
                          value={form.cnpp.fecha_impugnacion}
                          onChange={(e) => setForm({ ...form, cnpp: { ...form.cnpp, fecha_impugnacion: e.target.value } })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. MASC en Investigación */}
                <div className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] text-[#F5F5F3]/80">
                      ¿Se llegó a un mecanismo alterno de solución de controversia (MASC) en etapa de Investigación?
                    </span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[#F5F5F3]">
                        <input
                          type="radio"
                          name="cnpp_masc"
                          value="si"
                          checked={form.cnpp.masc_investigacion === "si"}
                          onChange={() => setForm({ ...form, cnpp: { ...form.cnpp, masc_investigacion: "si" } })}
                          className="accent-[#C9A227] w-3.5 h-3.5"
                        />
                        <span>SÍ</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[#F5F5F3]">
                        <input
                          type="radio"
                          name="cnpp_masc"
                          value="no"
                          checked={form.cnpp.masc_investigacion === "no"}
                          onChange={() => setForm({ ...form, cnpp: { ...form.cnpp, masc_investigacion: "no" } })}
                          className="accent-[#C9A227] w-3.5 h-3.5"
                        />
                        <span>NO</span>
                      </label>
                    </div>
                  </div>

                  {form.cnpp.masc_investigacion === "si" && (
                    <div className="space-y-3 pt-2 border-t border-[#161616]">
                      <div>
                        <label className={labelCls}>Número de Acuerdo MASC</label>
                        <input
                          className={inputCls}
                          value={form.cnpp.masc_numero_acuerdo}
                          onChange={(e) => setForm({ ...form, cnpp: { ...form.cnpp, masc_numero_acuerdo: e.target.value } })}
                          placeholder="Ej. 123/2026"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Plazo: Fecha de Inicio</label>
                          <input
                            type="date"
                            className={inputCls}
                            value={form.cnpp.masc_fecha_inicio}
                            onChange={(e) => setForm({ ...form, cnpp: { ...form.cnpp, masc_fecha_inicio: e.target.value } })}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Plazo: Fecha de Término</label>
                          <input
                            type="date"
                            className={inputCls}
                            value={form.cnpp.masc_fecha_termino}
                            onChange={(e) => setForm({ ...form, cnpp: { ...form.cnpp, masc_fecha_termino: e.target.value } })}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={labelCls + " mb-0"}>Especifique condiciones del acuerdo</label>
                          <span className="text-[10px] text-[#F5F5F3]/30">{(form.cnpp.masc_condiciones || "").length}/1000</span>
                        </div>
                        <textarea
                          className={inputCls}
                          rows={3}
                          maxLength={1000}
                          value={form.cnpp.masc_condiciones}
                          onChange={(e) => setForm({ ...form, cnpp: { ...form.cnpp, masc_condiciones: e.target.value } })}
                          placeholder="Describa las obligaciones, pagos reparatorios o condiciones pactadas en el acuerdo…"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={submit} disabled={!form.title || !form.client_id || saving} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors font-medium">{saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Crear Caso"}</button>
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
              <button
                type="button"
                onClick={() => setDetailTab("penal")}
                className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors border-b-2 ${
                  detailTab === "penal"
                    ? "border-[#C9A227] text-[#C9A227] font-medium"
                    : "border-transparent text-[#F5F5F3]/40 hover:text-[#F5F5F3]"
                }`}
              >
                <Folder size={13} />
                <span>Fase Penal (CNPP)</span>
              </button>
            </div>

            {/* Tab: Documentos */}
            {detailTab === "documentos" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[#F5F5F3]/40">Documentos vinculados a este caso:</p>
                  <div className="flex items-center gap-2">
                    {permissions?.can_create_documents && (
                      <button
                        type="button"
                        onClick={() => {
                          const caseId = selectedCaseDetail.id;
                          setSelectedCaseDetail(null);
                          navigate(`/documentos?caseId=${caseId}&upload=true`);
                        }}
                        className="text-xs bg-[#C9A227] text-[#080808] font-bold px-2.5 py-1 rounded flex items-center gap-1 hover:bg-[#A8841D] transition-colors"
                      >
                        <Plus size={13} />
                        <span>Subir Documento</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const caseId = selectedCaseDetail.id;
                        setSelectedCaseDetail(null);
                        navigate(`/documentos?caseId=${caseId}`);
                      }}
                      className="text-xs text-[#C9A227] hover:underline flex items-center gap-1"
                    >
                      <span>Ver Apartado en Documentos</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>

                {detailLoading ? (
                  <p className="text-xs text-[#F5F5F3]/30 py-6 text-center">Cargando documentos…</p>
                ) : caseDocs.length === 0 ? (
                  <div className="p-8 text-center bg-[#0A0A0A] border border-[#161616] rounded">
                    <FileText size={28} className="text-[#F5F5F3]/10 mx-auto mb-2" />
                    <p className="text-xs text-[#F5F5F3]/40 mb-3">No hay documentos registrados en este caso aún.</p>
                    {permissions?.can_create_documents && (
                      <button
                        type="button"
                        onClick={() => {
                          const caseId = selectedCaseDetail.id;
                          setSelectedCaseDetail(null);
                          navigate(`/documentos?caseId=${caseId}&upload=true`);
                        }}
                        className="text-xs bg-[#C9A227] text-[#080808] font-bold px-3 py-1.5 rounded inline-flex items-center gap-1.5 hover:bg-[#A8841D] transition-colors"
                      >
                        <Plus size={13} />
                        <span>Subir primer documento a este caso</span>
                      </button>
                    )}
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
              <div className="space-y-4 bg-[#0A0A0A] border border-[#1A1A1A] p-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4 pb-3 border-b border-[#161616] items-start">
                  <div className="min-w-0">
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block">Área de Práctica</span>
                    <span className="text-[#F5F5F3] font-medium">{selectedCaseDetail.practice_area || "—"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block">Oficina / Área</span>
                    <span className="text-[#F5F5F3] font-medium">{areas.find(a => a.id === selectedCaseDetail.area_id)?.name || "Sin Área Asignada"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block">Abogado(s) Asignados</span>
                    <span className="text-[#F5F5F3] font-medium">{lawyers(selectedCaseDetail.assigned_lawyers)}</span>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block mb-1">Correos</span>
                    <div className="space-y-1 break-words">
                      {[
                        dbClients.find(client => client.id === selectedCaseDetail.client_id)?.email,
                        ...toArray(selectedCaseDetail.assigned_lawyers).map(lawyer => members.find(member =>
                          member.full_name === lawyer || member.email === lawyer
                        )?.email)
                      ].filter(Boolean).map((email) => (
                        <a key={email} href={`mailto:${email}`} className="block text-[#F5F5F3] font-medium hover:text-[#C9A227] transition-colors">
                          {email}
                        </a>
                      ))}
                      {!dbClients.find(client => client.id === selectedCaseDetail.client_id)?.email &&
                        !toArray(selectedCaseDetail.assigned_lawyers).some(lawyer => members.some(member =>
                          (member.full_name === lawyer || member.email === lawyer) && member.email
                        )) && (
                          <span className="text-[#F5F5F3]/50">Sin correos registrados</span>
                        )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block">Próxima Audiencia</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#F5F5F3] font-medium break-words">
                        {selectedCaseDetail.next_hearing ? new Date(selectedCaseDetail.next_hearing).toLocaleDateString("es") : "Sin audiencia agendada"}
                      </span>
                      {selectedCaseDetail.next_hearing && (
                        <a
                          href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Audiencia: ${selectedCaseDetail.title} (${selectedCaseDetail.case_number || ''})`)}&dates=${selectedCaseDetail.next_hearing.replace(/-/g, '')}/${selectedCaseDetail.next_hearing.replace(/-/g, '')}&details=${encodeURIComponent(`Audiencia programada para el caso: ${selectedCaseDetail.title}\nExpediente: ${selectedCaseDetail.case_number || 'N/A'}\nJuzgado/Autoridad: ${selectedCaseDetail.court || 'N/A'}`)}&location=${encodeURIComponent(selectedCaseDetail.court || 'Juzgado')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#C9A227] hover:underline bg-[#C9A227]/10 px-2 py-0.5 rounded-sm border border-[#C9A227]/20"
                          title="Añadir audiencia a Google Calendar"
                        >
                          <ExternalLink size={11} /> Google Calendar
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider block mb-1">Descripción y Notas del Caso</span>
                  <p className="text-[#F5F5F3]/70 leading-relaxed bg-[#0F0F0F] p-3 border border-[#161616] whitespace-pre-wrap">
                    {cleanCaseDescription(selectedCaseDetail.description) || "Sin notas adicionales registradas para este caso."}
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Fase Penal / CNPP */}
            {detailTab === "penal" && (() => {
              const cnpp = parseCnppData(selectedCaseDetail.description);
              return (
                <div className="space-y-4 bg-[#0A0A0A] border border-[#1A1A1A] p-5 text-xs rounded-sm">
                  {!cnpp.active && !cnpp.carpeta_investigacion && !cnpp.delito ? (
                    <div className="text-center py-10">
                      <Folder size={32} className="text-[#F5F5F3]/10 mx-auto mb-2" />
                      <p className="text-xs text-[#F5F5F3]/40 mb-3">No se han registrado datos de la fase de investigación para este caso.</p>
                      {permissions?.can_edit_cases && (
                        <button
                          type="button"
                          onClick={() => {
                            const c = selectedCaseDetail;
                            setSelectedCaseDetail(null);
                            openEdit(c);
                          }}
                          className="px-3.5 py-2 bg-[#C9A227] text-[#080808] font-bold text-xs uppercase tracking-wider rounded hover:bg-[#A8841D] transition-colors inline-flex items-center gap-1.5"
                        >
                          <Pencil size={12} /> Habilitar Carpeta Penal (CNPP)
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Sujeto & Carpeta Header */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-[#0F0F0F] border border-[#161616]">
                          <span className="text-[10px] uppercase tracking-wider text-[#F5F5F3]/40 block mb-1">Calidad Procesal</span>
                          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded ${
                            cnpp.calidad === "victima" ? "bg-amber-400/10 text-amber-300 border border-amber-400/30" : "bg-red-400/10 text-red-300 border border-red-400/30"
                          }`}>
                            {cnpp.calidad === "victima" ? "Víctima / Ofendido" : "Imputado / Investigado"}
                          </span>
                        </div>
                        <div className="p-3 bg-[#0F0F0F] border border-[#161616]">
                          <span className="text-[10px] uppercase tracking-wider text-[#F5F5F3]/40 block mb-1">Delito</span>
                          <span className="text-xs font-medium text-[#F5F5F3]">{cnpp.delito || "Sin especificar"}</span>
                        </div>
                        <div className="p-3 bg-[#0F0F0F] border border-[#161616]">
                          <span className="text-[10px] uppercase tracking-wider text-[#F5F5F3]/40 block mb-1">No. Carpeta de Investigación</span>
                          <span className="text-xs font-mono font-medium text-[#C9A227]">{cnpp.carpeta_investigacion || "—"}</span>
                        </div>
                      </div>

                      {/* Determinación de Carpeta */}
                      <div className="p-4 bg-[#0F0F0F] border border-[#161616] space-y-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#F5F5F3]/40 block">Determinación de Carpeta</span>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#C9A227]" />
                          <span className="text-sm font-semibold text-[#F5F5F3]">
                            {DETERMINACION_LABELS[cnpp.determinacion] || cnpp.determinacion || "En trámite"}
                          </span>
                        </div>

                        {/* Recurso innominado Art. 258 CNPP */}
                        <div className="mt-3 pt-3 border-t border-[#1C1C1C] flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-[#F5F5F3]/70">
                            Impugnación mediante Recurso innominado (Artículo 258 CNPP):
                          </span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 border ${
                            cnpp.impugno_258 === "si" ? "text-amber-400 border-amber-400/30 bg-amber-400/10" : "text-[#F5F5F3]/30 border-[#222]"
                          }`}>
                            {cnpp.impugno_258 === "si" ? `SÍ · Fecha de impugnación: ${cnpp.fecha_impugnacion ? new Date(cnpp.fecha_impugnacion).toLocaleDateString("es") : "Sin fecha"}` : "NO"}
                          </span>
                        </div>
                      </div>

                      {/* MASC en Etapa de Investigación */}
                      <div className="p-4 bg-[#0F0F0F] border border-[#161616] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-[#F5F5F3]/40 font-medium">
                            Mecanismo Alterno de Solución de Controversia (MASC) en Investigación
                          </span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 border ${
                            cnpp.masc_investigacion === "si" ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" : "text-[#F5F5F3]/30 border-[#222]"
                          }`}>
                            {cnpp.masc_investigacion === "si" ? "Acuerdo MASC Celebrado ✓" : "Sin MASC"}
                          </span>
                        </div>

                        {cnpp.masc_investigacion === "si" && (
                          <div className="space-y-3 pt-2 border-t border-[#1C1C1C]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <span className="text-[10px] text-[#F5F5F3]/40 uppercase block">No. de Acuerdo MASC</span>
                                <span className="text-xs font-mono font-medium text-[#F5F5F3]">{cnpp.masc_numero_acuerdo || "—"}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#F5F5F3]/40 uppercase block">Plazo de Acuerdo</span>
                                <span className="text-xs text-[#F5F5F3]">
                                  {cnpp.masc_fecha_inicio ? new Date(cnpp.masc_fecha_inicio).toLocaleDateString("es") : "—"} al {cnpp.masc_fecha_termino ? new Date(cnpp.masc_fecha_termino).toLocaleDateString("es") : "—"}
                                </span>
                              </div>
                            </div>
                            {cnpp.masc_condiciones && (
                              <div>
                                <span className="text-[10px] text-[#F5F5F3]/40 uppercase block mb-1">Condiciones del Acuerdo</span>
                                <p className="text-xs text-[#F5F5F3]/80 bg-[#080808] p-3 border border-[#161616] whitespace-pre-line leading-relaxed">
                                  {cnpp.masc_condiciones}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}