import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, FileText, Download, Upload, Pencil, Trash2, Search, Eye, ExternalLink, X, Folder, FolderOpen, List, ChevronDown, ChevronRight, Layers } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";
import { logActivity } from "@/lib/activityLogger";
import { createNotification } from "@/lib/notificationService";

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

function getFileType(doc) {
  if (!doc) return "unknown";
  const nameOrUrl = (doc.file_name || doc.file_url || "").toLowerCase();
  if (nameOrUrl.endsWith(".pdf") || nameOrUrl.includes(".pdf")) return "pdf";
  if (nameOrUrl.match(/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/)) return "image";
  if (nameOrUrl.match(/\.(docx?|odt)(\?.*)?$/)) return "word";
  if (nameOrUrl.match(/\.(xlsx?|csv)(\?.*)?$/)) return "sheet";
  if (nameOrUrl.match(/\.(txt|md)(\?.*)?$/)) return "text";
  return "other";
}

export default function Documentos() {
  const { user, profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [docs, setDocs] = useState([]);
  const [cases, setCases] = useState([]);
  const [members, setMembers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("carpetas"); // 'carpetas' | 'lista'
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [wordViewerEngine, setWordViewerEngine] = useState("office"); // 'office' | 'google'
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
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

  const filtered = visibleDocs.filter((d) => {
    // Type filter
    let matchesType = true;
    if (filterType !== "all") {
      if (filterType === "amparo") {
        matchesType = d.doc_type === "amparo_directo" || d.doc_type === "amparo_indirecto" || d.doc_type === "amparo";
      } else {
        matchesType = d.doc_type === filterType;
      }
    }
    if (!matchesType) return false;

    // Search term filter
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const caseObj = cases.find((c) => c.id === d.case_id);
    const caseTitle = (caseObj?.title || "").toLowerCase();
    const caseNum = (caseObj?.case_number || "").toLowerCase();
    const docTitle = (d.title || "").toLowerCase();
    const docLawyer = (d.lawyer || "").toLowerCase();
    const fileName = (d.file_name || "").toLowerCase();
    const typeLabel = (docTypeLabels[d.doc_type] || d.doc_type || "").toLowerCase();

    return (
      docTitle.includes(term) ||
      docLawyer.includes(term) ||
      caseTitle.includes(term) ||
      caseNum.includes(term) ||
      fileName.includes(term) ||
      typeLabel.includes(term)
    );
  });

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `docs/${fileName}`;

      const { data, error } = await supabase.storage.from('documents').upload(filePath, file, {
        contentType: file.type || 'application/pdf',
        upsert: true
      });
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

  const openNew = (defaultCaseId = "") => { 
    setEditingId(null); 
    setForm({ 
      ...EMPTY, 
      case_id: typeof defaultCaseId === "string" ? defaultCaseId : "",
      doc_type: isPenalArea ? "expediente" : "contrato" 
    }); 
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

      let res;
      if (editingId) { 
        res = await supabase.from('documents').update(payload).eq('id', editingId); 
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "EDITAR",
            module: "Documentos",
            description: `Editó el documento "${form.title}" (${docTypeLabels[finalDocType] || finalDocType})`,
            metadata: { document_id: editingId, file_name: form.file_name, file_url: form.file_url }
          });
        }
      } else { 
        res = await supabase.from('documents').insert([payload]); 
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: form.file_url ? "SUBIR" : "CREAR",
            module: "Documentos",
            description: form.file_url 
              ? `Subió el documento "${form.title}" (${form.file_name || 'archivo'})`
              : `Creó el documento "${form.title}"`,
            metadata: { file_name: form.file_name, file_url: form.file_url, doc_type: finalDocType }
          });
        }
      }
      if (res.error) throw res.error;

      // Disparar notificación al abogado asignado
      if (form.lawyer) {
        createNotification({
          recipientName: form.lawyer,
          type: "documento",
          title: editingId ? "Documento actualizado" : "Nuevo documento asignado",
          message: `Te han asignado el documento "${form.title}" (${docTypeLabels[finalDocType] || finalDocType})`,
          link: "/documentos",
          metadata: { doc_title: form.title, file_name: form.file_name }
        });
      }

      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { 
      console.error(e); 
      alert("Error al guardar el documento: " + (e.message || JSON.stringify(e)));
    } finally { 
      setSaving(false); 
    }
  };

  const remove = async (d) => {
    if (!confirm(`¿Eliminar el documento "${d.title}"?`)) return;
    try { 
      const res = await supabase.from('documents').delete().eq('id', d.id); 
      if (!res.error) {
        logActivity({
          userId: user?.id,
          userName: profile?.full_name || user?.email || "Usuario",
          userEmail: user?.email,
          action: "ELIMINAR",
          module: "Documentos",
          description: `Eliminó el documento "${d.title}" (${d.file_name || 'sin archivo'})`,
          metadata: { document_id: d.id, file_name: d.file_name, file_url: d.file_url }
        });
      }
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

  const selectedCaseForDoc = cases.find(c => c.id === form.case_id);
  const activeDocAreaId = selectedCaseForDoc?.area_id || (!isAdmin ? profile?.area_id : null);
  const eligibleLawyersForDoc = activeDocAreaId
    ? members.filter(m => m.area_id === activeDocAreaId || !m.area_id || ['Admin', 'Direccion General'].includes(m.role))
    : members;

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

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F5F5F3]/20" />
          <input
            type="text"
            className="w-full bg-[#080808] border border-[#1A1A1A] pl-11 pr-8 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors"
            placeholder="Buscar por título, caso, tipo o abogado…"
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
        
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2.5 focus:outline-none focus:border-[#C9A227]"
          >
            <option value="all">Todos los tipos</option>
            {activeTypes.map((t) => (
              <option key={t} value={t}>
                {docTypeLabels[t] || cap(t)}
              </option>
            ))}
          </select>

          {/* View Mode Toggle: Carpetas vs Lista */}
          <div className="flex bg-[#080808] border border-[#1A1A1A] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("carpetas")}
              className={`p-2 text-xs flex items-center gap-1.5 transition-colors ${
                viewMode === "carpetas"
                  ? "bg-[#C9A227] text-[#080808] font-medium"
                  : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"
              }`}
              title="Vista por Carpetas de Caso"
            >
              <Folder size={14} />
              <span className="hidden md:inline text-[11px] tracking-wider uppercase">Carpetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("lista")}
              className={`p-2 text-xs flex items-center gap-1.5 transition-colors ${
                viewMode === "lista"
                  ? "bg-[#C9A227] text-[#080808] font-medium"
                  : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"
              }`}
              title="Vista de Lista General"
            >
              <List size={14} />
              <span className="hidden md:inline text-[11px] tracking-wider uppercase">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Helper actions when in folder view */}
      {viewMode === "carpetas" && !loading && (
        <div className="flex items-center justify-between text-xs text-[#F5F5F3]/40 mb-3 px-1">
          <span>Agrupados por Carpeta de Caso</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsedFolders({})}
              className="hover:text-[#C9A227] transition-colors"
            >
              Expandir todas
            </button>
            <span>·</span>
            <button
              onClick={() => {
                const all = {};
                cases.forEach(c => { all[c.id] = true; });
                all["unassigned"] = true;
                setCollapsedFolders(all);
              }}
              className="hover:text-[#C9A227] transition-colors"
            >
              Colapsar todas
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[#F5F5F3]/30 text-sm">Cargando documentos…</p>
      ) : (
        <>
          {/* VISTA 1: CARPETAS POR CASO */}
          {viewMode === "carpetas" && (
            <div className="space-y-3">
              {(() => {
                // Group filtered documents by case
                const docsByCase = {};
                const unassignedDocs = [];

                filtered.forEach((d) => {
                  if (d.case_id) {
                    if (!docsByCase[d.case_id]) docsByCase[d.case_id] = [];
                    docsByCase[d.case_id].push(d);
                  } else {
                    unassignedDocs.push(d);
                  }
                });

                const caseIds = Object.keys(docsByCase);

                if (caseIds.length === 0 && unassignedDocs.length === 0) {
                  return (
                    <div className="bg-[#080808] border border-[#1A1A1A] text-center py-16">
                      <Folder size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" />
                      <p className="text-[#F5F5F3]/20 text-sm">
                        {searchTerm ? "No se encontraron documentos en carpetas para esta búsqueda" : "Sin documentos"}
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Render each case folder */}
                    {caseIds.map((caseId) => {
                      const caseObj = cases.find((c) => c.id === caseId);
                      const caseDocs = docsByCase[caseId] || [];
                      const isCollapsed = !!collapsedFolders[caseId];

                      return (
                        <div
                          key={caseId}
                          className="bg-[#080808] border border-[#1A1A1A] overflow-hidden transition-colors hover:border-[#262626]"
                        >
                          {/* Folder Header */}
                          <div
                            onClick={() =>
                              setCollapsedFolders((prev) => ({
                                ...prev,
                                [caseId]: !prev[caseId],
                              }))
                            }
                            className="p-4 bg-[#0A0A0A] flex items-center justify-between cursor-pointer select-none hover:bg-[#0E0E0E] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {isCollapsed ? (
                                <Folder size={18} className="text-[#C9A227] flex-shrink-0" />
                              ) : (
                                <FolderOpen size={18} className="text-[#C9A227] flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-[#F5F5F3] text-sm font-medium truncate">
                                    {caseObj?.title || "Caso sin título"}
                                  </h4>
                                  <span className="text-[10px] text-[#C9A227] font-mono bg-[#C9A227]/10 px-2 py-0.5 border border-[#C9A227]/20">
                                    {caseObj?.case_number || "Folio"}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#F5F5F3]/40 truncate">
                                  {caseObj?.client ? `Cliente: ${caseObj.client}` : ""}
                                  {caseObj?.practice_area ? ` · ${caseObj.practice_area}` : ""}
                                </p>
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-3 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-xs text-[#F5F5F3]/60 bg-[#121212] px-2.5 py-1 border border-[#1E1E1E]">
                                {caseDocs.length} {caseDocs.length === 1 ? "documento" : "documentos"}
                              </span>
                              {permissions?.can_create_documents && (
                                <button
                                  onClick={() => openNew(caseId)}
                                  className="text-xs text-[#C9A227] hover:text-[#080808] hover:bg-[#C9A227] p-1.5 border border-[#C9A227]/30 transition-colors"
                                  title="Subir documento a este caso"
                                >
                                  <Plus size={14} />
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setCollapsedFolders((prev) => ({
                                    ...prev,
                                    [caseId]: !prev[caseId],
                                  }))
                                }
                                className="text-[#F5F5F3]/40 hover:text-[#F5F5F3] p-1"
                              >
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </div>

                          {/* Folder Files List */}
                          {!isCollapsed && (
                            <div className="border-t border-[#1A1A1A] divide-y divide-[#141414]">
                              {caseDocs.map((d) => {
                                const fType = getFileType(d);
                                return (
                                  <div
                                    key={d.id}
                                    onClick={() => { if (d.file_url) setViewingDoc(d); }}
                                    className={`flex items-center justify-between p-4 pl-8 hover:bg-[#0F0F0F] transition-colors group ${d.file_url ? "cursor-pointer" : ""}`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <FileText size={16} className="text-[#C9A227] flex-shrink-0" />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="text-[#F5F5F3] text-sm truncate group-hover:text-[#C9A227] transition-colors">{d.title}</p>
                                          {fType === "word" && (
                                            <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                              WORD
                                            </span>
                                          )}
                                          {fType === "pdf" && (
                                            <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                                              PDF
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[#F5F5F3]/30 text-[11px] truncate">
                                          {docTypeLabels[d.doc_type] || cap(d.doc_type)}
                                          {d.lawyer ? ` · ${d.lawyer}` : " · Sin abogado"}
                                          {d.file_name ? ` · ${d.file_name}` : ""}
                                          {` · ${new Date(d.created_at).toLocaleDateString("es")}`}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <span className={`text-[9px] tracking-wider uppercase px-2 py-1 ${statusColors[d.status] || ""}`}>{d.status}</span>
                                      {d.file_url && (
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setViewingDoc(d)}
                                            className="p-1.5 text-[#F5F5F3]/40 hover:text-[#C9A227] transition-colors"
                                            title="Visualizar documento"
                                          >
                                            <Eye size={15} />
                                          </button>
                                          <a
                                            href={d.file_url}
                                            download={d.file_name || d.title}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"
                                            title="Descargar archivo original"
                                          >
                                            <Download size={15} />
                                          </a>
                                        </div>
                                      )}
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {permissions?.can_edit_documents && (
                                          <button onClick={() => openEdit(d)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors" title="Editar"><Pencil size={14} /></button>
                                        )}
                                        {permissions?.can_delete_documents && (
                                          <button onClick={() => remove(d)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Unassigned Documents Folder */}
                    {unassignedDocs.length > 0 && (
                      <div className="bg-[#080808] border border-[#1A1A1A] overflow-hidden transition-colors hover:border-[#262626]">
                        <div
                          onClick={() =>
                            setCollapsedFolders((prev) => ({
                              ...prev,
                              unassigned: !prev["unassigned"],
                            }))
                          }
                          className="p-4 bg-[#0A0A0A] flex items-center justify-between cursor-pointer select-none hover:bg-[#0E0E0E] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {collapsedFolders["unassigned"] ? (
                              <Folder size={18} className="text-[#F5F5F3]/40 flex-shrink-0" />
                            ) : (
                              <FolderOpen size={18} className="text-[#F5F5F3]/40 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <h4 className="text-[#F5F5F3] text-sm font-medium truncate">
                                Documentos Generales (Sin Caso Asociado)
                              </h4>
                              <p className="text-[11px] text-[#F5F5F3]/30">Documentos no vinculados a ningún expediente específico</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-[#F5F5F3]/60 bg-[#121212] px-2.5 py-1 border border-[#1E1E1E]">
                              {unassignedDocs.length} documentos
                            </span>
                            <button
                              onClick={() =>
                                setCollapsedFolders((prev) => ({
                                  ...prev,
                                  unassigned: !prev["unassigned"],
                                }))
                              }
                              className="text-[#F5F5F3]/40 hover:text-[#F5F5F3] p-1"
                            >
                              {collapsedFolders["unassigned"] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {!collapsedFolders["unassigned"] && (
                          <div className="border-t border-[#1A1A1A] divide-y divide-[#141414]">
                            {unassignedDocs.map((d) => {
                              const fType = getFileType(d);
                              return (
                                <div
                                  key={d.id}
                                  onClick={() => { if (d.file_url) setViewingDoc(d); }}
                                  className={`flex items-center justify-between p-4 pl-8 hover:bg-[#0F0F0F] transition-colors group ${d.file_url ? "cursor-pointer" : ""}`}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <FileText size={16} className="text-[#C9A227] flex-shrink-0" />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-[#F5F5F3] text-sm truncate group-hover:text-[#C9A227] transition-colors">{d.title}</p>
                                        {fType === "word" && (
                                          <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                            WORD
                                          </span>
                                        )}
                                        {fType === "pdf" && (
                                          <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                                            PDF
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[#F5F5F3]/30 text-[11px] truncate">
                                        {docTypeLabels[d.doc_type] || cap(d.doc_type)}
                                        {d.lawyer ? ` · ${d.lawyer}` : " · Sin abogado"}
                                        {d.file_name ? ` · ${d.file_name}` : ""}
                                        {` · ${new Date(d.created_at).toLocaleDateString("es")}`}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <span className={`text-[9px] tracking-wider uppercase px-2 py-1 ${statusColors[d.status] || ""}`}>{d.status}</span>
                                    {d.file_url && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => setViewingDoc(d)}
                                          className="p-1.5 text-[#F5F5F3]/40 hover:text-[#C9A227] transition-colors"
                                          title="Visualizar documento"
                                        >
                                          <Eye size={15} />
                                        </button>
                                        <a
                                          href={d.file_url}
                                          download={d.file_name || d.title}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"
                                          title="Descargar archivo original"
                                        >
                                          <Download size={15} />
                                        </a>
                                      </div>
                                    )}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {permissions?.can_edit_documents && (
                                        <button onClick={() => openEdit(d)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors" title="Editar"><Pencil size={14} /></button>
                                      )}
                                      {permissions?.can_delete_documents && (
                                        <button onClick={() => remove(d)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* VISTA 2: LISTA PLANA TRADICIONAL */}
          {viewMode === "lista" && (
            <div className="bg-[#080808] border border-[#1A1A1A]">
              {filtered.map((d, i) => {
                const linkedCase = cases.find((c) => c.id === d.case_id);
                const fType = getFileType(d);
                return (
                  <div 
                    key={d.id} 
                    onClick={() => { if (d.file_url) setViewingDoc(d); }}
                    className={`flex items-center justify-between p-4 hover:bg-[#0F0F0F] transition-colors group ${d.file_url ? "cursor-pointer" : ""} ${i !== filtered.length - 1 ? "border-b border-[#1A1A1A]" : ""}`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <FileText size={18} className="text-[#C9A227] flex-shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[#F5F5F3] text-sm truncate group-hover:text-[#C9A227] transition-colors">{d.title}</p>
                          {fType === "word" && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                              WORD
                            </span>
                          )}
                          {fType === "pdf" && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                              PDF
                            </span>
                          )}
                        </div>
                        <p className="text-[#F5F5F3]/30 text-[11px] truncate">
                          {docTypeLabels[d.doc_type] || cap(d.doc_type)}
                          {linkedCase ? ` · Caso: ${linkedCase.title}` : ""}
                          {` · ${d.lawyer || "Sin abogado"}`}
                          {d.file_name ? ` · ${d.file_name}` : ""}
                          {` · ${new Date(d.created_at).toLocaleDateString("es")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className={`text-[9px] tracking-wider uppercase px-2 py-1 ${statusColors[d.status] || ""}`}>{d.status}</span>
                      {d.file_url && (
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => setViewingDoc(d)} 
                            className="p-1.5 text-[#F5F5F3]/40 hover:text-[#C9A227] transition-colors" 
                            title="Visualizar documento"
                          >
                            <Eye size={15} />
                          </button>
                          <a 
                            href={d.file_url} 
                            download={d.file_name || d.title}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-1.5 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors" 
                            title="Descargar archivo original"
                          >
                            <Download size={15} />
                          </a>
                        </div>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {permissions?.can_edit_documents && (
                          <button onClick={() => openEdit(d)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors" title="Editar"><Pencil size={14} /></button>
                        )}
                        {permissions?.can_delete_documents && (
                          <button onClick={() => remove(d)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-16">
                  <FileText size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" />
                  <p className="text-[#F5F5F3]/20 text-sm">
                    {searchTerm ? "No se encontraron documentos para esta búsqueda" : "Sin documentos"}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
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
            <label className={labelCls}>
              Abogado {activeDocAreaId && <span className="text-[#C9A227] font-normal normal-case">({areas.find(a => a.id === activeDocAreaId)?.name})</span>}
            </label>
            <select className={inputCls} value={form.lawyer} onChange={(e) => setForm({ ...form, lawyer: e.target.value })}>
              <option value="">Seleccionar abogado...</option>
              {eligibleLawyersForDoc.map((m) => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
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

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in"
          onClick={() => setViewingDoc(null)}
        >
          <div 
            className="relative w-full max-w-5xl h-[90vh] bg-[#080808] border border-[#1A1A1A] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Viewer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A] bg-[#0A0A0A] flex-shrink-0">
              <div className="min-w-0 flex items-center gap-3">
                <FileText size={18} className="text-[#C9A227] flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[#F5F5F3] text-sm font-medium truncate">{viewingDoc.title}</h3>
                    <span className={`text-[8px] tracking-wider uppercase px-2 py-0.5 font-medium ${statusColors[viewingDoc.status] || ""}`}>
                      {viewingDoc.status}
                    </span>
                  </div>
                  <p className="text-[#F5F5F3]/40 text-[11px] truncate">
                    {docTypeLabels[viewingDoc.doc_type] || cap(viewingDoc.doc_type)}
                    {viewingDoc.case_id && cases.find(c => c.id === viewingDoc.case_id) ? ` · Caso: ${cases.find(c => c.id === viewingDoc.case_id).title}` : ""}
                    {viewingDoc.lawyer ? ` · ${viewingDoc.lawyer}` : ""}
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {viewingDoc.file_url && (
                  <>
                    <a 
                      href={viewingDoc.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="px-3 py-1.5 bg-[#141414] hover:bg-[#1E1E1E] text-[#F5F5F3]/70 hover:text-[#C9A227] border border-[#1E1E1E] text-xs flex items-center gap-1.5 transition-colors"
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink size={13} />
                      <span className="hidden sm:inline">Nueva pestaña</span>
                    </a>
                    <a 
                      href={viewingDoc.file_url} 
                      download={viewingDoc.file_name || `${viewingDoc.title}.${getFileType(viewingDoc) === 'word' ? 'docx' : 'pdf'}`}
                      className="px-3 py-1.5 bg-[#C9A227] hover:bg-[#A8841D] text-[#080808] font-medium border border-[#C9A227] text-xs flex items-center gap-1.5 transition-colors"
                      title="Descargar archivo original"
                    >
                      <Download size={13} />
                      <span className="hidden sm:inline">
                        {getFileType(viewingDoc) === "word" ? "Descargar Word (.docx)" : "Descargar"}
                      </span>
                    </a>
                  </>
                )}
                <button 
                  onClick={() => setViewingDoc(null)} 
                  className="p-1.5 text-[#F5F5F3]/40 hover:text-red-400 transition-colors ml-1"
                  title="Cerrar visor"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 bg-[#050505] p-2 overflow-hidden flex flex-col items-center justify-center">
              {(() => {
                const fType = getFileType(viewingDoc);

                if (fType === "image") {
                  return (
                    <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                      <img 
                        src={viewingDoc.file_url} 
                        alt={viewingDoc.title} 
                        className="max-w-full max-h-full object-contain select-none" 
                      />
                    </div>
                  );
                }

                if (fType === "pdf") {
                  return (
                    <iframe
                      src={`${viewingDoc.file_url}#toolbar=1`}
                      className="w-full h-full border-0 bg-white"
                      title={viewingDoc.title}
                    />
                  );
                }

                if (fType === "word") {
                  return (
                    <div className="w-full h-full flex flex-col bg-white">
                      {/* Word Toolbar */}
                      <div className="px-4 py-2 bg-[#0C0C0C] border-b border-[#1A1A1A] flex flex-wrap items-center justify-between gap-2 text-xs flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#C9A227] bg-[#C9A227]/10 px-2 py-0.5 border border-[#C9A227]/20">
                            Previsualización Word (Lectura)
                          </span>
                          <div className="flex bg-[#141414] border border-[#1E1E1E] p-0.5 rounded">
                            <button
                              type="button"
                              onClick={() => setWordViewerEngine("office")}
                              className={`px-2 py-0.5 text-[10px] transition-colors ${
                                wordViewerEngine === "office"
                                  ? "bg-[#C9A227] text-[#080808] font-semibold"
                                  : "text-[#F5F5F3]/50 hover:text-[#F5F5F3]"
                              }`}
                            >
                              Office Viewer
                            </button>
                            <button
                              type="button"
                              onClick={() => setWordViewerEngine("google")}
                              className={`px-2 py-0.5 text-[10px] transition-colors ${
                                wordViewerEngine === "google"
                                  ? "bg-[#C9A227] text-[#080808] font-semibold"
                                  : "text-[#F5F5F3]/50 hover:text-[#F5F5F3]"
                              }`}
                            >
                              Google Docs
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#F5F5F3]/40 hidden md:inline">
                          El archivo descargado se conserva en su formato .docx original
                        </span>
                      </div>

                      <iframe
                        src={
                          wordViewerEngine === "office"
                            ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewingDoc.file_url)}`
                            : `https://docs.google.com/viewer?url=${encodeURIComponent(viewingDoc.file_url)}&embedded=true`
                        }
                        className="w-full h-full border-0 bg-white"
                        title={viewingDoc.title}
                      />
                    </div>
                  );
                }

                if (fType === "sheet") {
                  return (
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingDoc.file_url)}&embedded=true`}
                      className="w-full h-full border-0 bg-white"
                      title={viewingDoc.title}
                    />
                  );
                }

                return (
                  <iframe
                    src={viewingDoc.file_url}
                    className="w-full h-full border-0 bg-white"
                    title={viewingDoc.title}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}