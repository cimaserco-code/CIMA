import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, FileText, Download, Upload, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";

const TYPES = ["contrato", "demanda", "evidencia", "escrito", "otro"];
const PENAL_TYPES = ["expediente", "carpeta_investigacion", "proceso_penal", "amparo", "reporte", "sentencia", "evidencia", "correspondencia", "otro"];

const docTypeLabels = {
  contrato: "Contrato",
  demanda: "Demanda",
  evidencia: "Evidencia",
  escrito: "Escrito",
  otro: "Otro",
  // Penal types
  expediente: "Expediente",
  carpeta_investigacion: "Carpeta de investigación",
  proceso_penal: "Proceso penal",
  amparo: "Amparo",
  amparo_directo: "Amparo (Directo)",
  amparo_indirecto: "Amparo (Indirecto)",
  reporte: "Reporte",
  sentencia: "Sentencia",
  correspondencia: "Correspondencia"
};

const STATUSES = ["borrador", "editado", "finalizado"];
const statusColors = { borrador: "text-[#F5F5F3]/40 bg-[#F5F5F3]/5", editado: "text-yellow-400 bg-yellow-400/10", finalizado: "text-green-400 bg-green-400/10" };

const EMPTY = { title: "", doc_type: "contrato", amparo_type: "directo", case_id: "", lawyer: "", status: "borrador", file_url: "", file_name: "" };

export default function Documentos() {
  const { profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [docs, setDocs] = useState([]);
  const [cases, setCases] = useState([]);
  const [members, setMembers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [dRes, cRes, mRes, aRes] = await Promise.all([
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
        supabase.from('cases').select('*'),
        supabase.from('team_members').select('*'),
        supabase.from('areas').select('*')
      ]);
      if (dRes.data) setDocs(dRes.data);
      if (cRes.data) setCases(cRes.data);
      if (mRes.data) setMembers(mRes.data);
      if (aRes.data) setAreas(aRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Determine if the current user belongs to Penal Area
  const userAreaName = areas.find(a => a.id === profile?.area_id)?.name || "";
  const isPenalArea = userAreaName.toLowerCase() === "penal";
  const activeTypes = isPenalArea ? PENAL_TYPES : TYPES;

  // Filter cases and documents by Area:
  // If not admin, only show cases belonging to user's assigned area.
  const visibleCases = cases.filter(c => isAdmin || c.area_id === profile?.area_id);
  const visibleDocs = docs.filter(d => !d.case_id || visibleCases.some(c => c.id === d.case_id));

  const filtered = filterType === "all" ? visibleDocs : visibleDocs.filter((d) => {
    if (filterType === "amparo") {
      return d.doc_type === "amparo_directo" || d.doc_type === "amparo_indirecto" || d.doc_type === "amparo";
    }
    return d.doc_type === filterType;
  });

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `docs/${fileName}`;

      const { data, error } = await supabase.storage.from('documents').upload(filePath, file);
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      setForm((f) => ({ 
        ...f, 
        file_url: publicUrlData.publicUrl,
        file_name: file.name
      }));
    } catch (err) { 
      console.error(err); 
      alert("Error al subir archivo a Supabase Storage: " + err.message);
    } finally { 
      setUploading(false); 
    }
  };

  const openNew = () => { 
    setEditingId(null); 
    setForm({ ...EMPTY, doc_type: isPenalArea ? "expediente" : "contrato" }); 
    setModalOpen(true); 
  };

  const openEdit = (d) => { 
    setEditingId(d.id); 
    
    // Deconstruct amparo types back to amparo + subtype
    let docType = d.doc_type || "contrato";
    let amparoType = "directo";
    if (docType === "amparo_directo") {
      docType = "amparo";
      amparoType = "directo";
    } else if (docType === "amparo_indirecto") {
      docType = "amparo";
      amparoType = "indirecto";
    }

    setForm({ 
      title: d.title || "", 
      doc_type: docType, 
      amparo_type: amparoType,
      case_id: d.case_id || "", 
      lawyer: d.lawyer || "",
      status: d.status || "borrador",
      file_url: d.file_url || "",
      file_name: d.file_name || ""
    }); 
    setModalOpen(true); 
  };

  const submit = async () => {
    setSaving(true);
    try {
      // Determine doc_type payload based on amparo selection
      let finalDocType = form.doc_type;
      if (finalDocType === "amparo") {
        finalDocType = form.amparo_type === "directo" ? "amparo_directo" : "amparo_indirecto";
      }

      const payload = {
        title: form.title,
        doc_type: finalDocType,
        case_id: form.case_id || null,
        lawyer: form.lawyer,
        status: form.status,
        file_url: form.file_url,
        file_name: form.file_name
      };

      if (editingId) { 
        await supabase.from('documents').update(payload).eq('id', editingId); 
      } else { 
        await supabase.from('documents').insert([payload]); 
      }
      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const remove = async (d) => {
    if (!confirm(`¿Eliminar el documento "${d.title}"?`)) return;
    try { 
      await supabase.from('documents').delete().eq('id', d.id); 
      load(); 
    } catch (e) { console.error(e); }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  if (!permissions?.can_view_documents) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#F5F5F3]/30">
        <FileText size={40} className="mb-3 opacity-20" />
        <p className="text-sm font-medium">Acceso Denegado</p>
        <p className="text-xs opacity-50 mt-1">No tienes permisos para ver este módulo.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Documentos" subtitle={`${filtered.length} documentos`} action={
        permissions?.can_create_documents && (
          <button onClick={openNew} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
            <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2"><Plus size={15} /> Subir Documento</span>
          </button>
        )
      } />

      <div className="flex flex-wrap gap-2 mb-6">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
          <option value="all">Todos los tipos</option>
          {activeTypes.map((t) => <option key={t} value={t}>{docTypeLabels[t] || cap(t)}</option>)}
        </select>
      </div>

      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando documentos…</p> : (
        <div className="bg-[#080808] border border-[#1A1A1A]">
          {filtered.map((d, i) => (
            <div key={d.id} className={`flex items-center justify-between p-4 hover:bg-[#0F0F0F] transition-colors group ${i !== filtered.length - 1 ? "border-b border-[#1A1A1A]" : ""}`}>
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <FileText size={18} className="text-[#C9A227] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[#F5F5F3] text-sm truncate">{d.title}</p>
                  <p className="text-[#F5F5F3]/30 text-[11px]">{docTypeLabels[d.doc_type] || cap(d.doc_type)} · {d.lawyer || "Sin abogado"} · {new Date(d.created_at).toLocaleDateString("es")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[9px] tracking-wider uppercase px-2 py-1 ${statusColors[d.status] || ""}`}>{d.status}</span>
                {d.file_url && <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"><Download size={15} /></a>}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {permissions?.can_edit_documents && (
                    <button onClick={() => openEdit(d)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"><Pencil size={14} /></button>
                  )}
                  {permissions?.can_delete_documents && (
                    <button onClick={() => remove(d)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-16"><FileText size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" /><p className="text-[#F5F5F3]/20 text-sm">Sin documentos</p></div>}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar Documento" : "Subir Documento"}>
        <div className="space-y-4">
          <div><label className={labelCls}>Título</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nombre del documento" /></div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select 
                className={inputCls} 
                value={form.doc_type} 
                onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
              >
                {activeTypes.map((t) => <option key={t} value={t}>{docTypeLabels[t] || cap(t)}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Estado</label><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</select></div>
          </div>

          {/* Conditional Amparo Sub-type Dropdown */}
          {form.doc_type === "amparo" && (
            <div>
              <label className={labelCls}>Subtipo de Amparo</label>
              <select 
                className={inputCls} 
                value={form.amparo_type} 
                onChange={(e) => setForm({ ...form, amparo_type: e.target.value })}
              >
                <option value="directo">Directo</option>
                <option value="indirecto">Indirecto</option>
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Caso Vinculado</label>
            <select className={inputCls} value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })}>
              <option value="">Sin vincular a caso</option>
              {visibleCases.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Abogado</label>
            <select className={inputCls} value={form.lawyer} onChange={(e) => setForm({ ...form, lawyer: e.target.value })}>
              <option value="">Seleccionar abogado...</option>
              {members.map((m) => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Archivo</label>
            <label className="flex items-center gap-2 border border-dashed border-[#2A2A2A] px-4 py-3 cursor-pointer hover:border-[#C9A227] transition-colors">
              <Upload size={15} className="text-[#F5F5F3]/30" />
              <span className="text-[#F5F5F3]/40 text-xs">{form.file_name || (form.file_url ? "Archivo cargado ✓" : uploading ? "Subiendo…" : "Seleccionar archivo")}</span>
              <input type="file" className="hidden" onChange={handleFile} />
            </label>
          </div>
          <button onClick={submit} disabled={!form.title || saving} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors">{saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Subir Documento"}</button>
        </div>
      </Modal>
    </div>
  );
}