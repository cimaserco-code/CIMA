import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, Mail, Phone, Briefcase, FileText, CheckSquare, ChevronRight, Search, Plus, Pencil, Trash2, Link } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";

const EMPTY = { full_name: "", email: "", phone: "", area_id: "", user_id: "" };

export default function Clientes() {
  const { profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [clients, setClients] = useState([]);
  const [profiles, setProfiles] = useState([]); // User profiles with role = 'Cliente'
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [docs, setDocs] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals and Selection
  const [selectedClient, setSelectedClient] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [clRes, pRes, cRes, tRes, dRes, aRes] = await Promise.all([
        supabase.from('clients').select('*').order('full_name'),
        supabase.from('profiles').select('*').eq('role', 'Cliente').order('full_name'),
        supabase.from('cases').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('areas').select('*').order('name')
      ]);
      if (clRes.data) setClients(clRes.data);
      if (pRes.data) setProfiles(pRes.data);
      if (cRes.data) setCases(cRes.data);
      if (tRes.data) setTasks(tRes.data);
      if (dRes.data) setDocs(dRes.data);
      if (aRes.data) setAreas(aRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filter clients based on Area (if not admin/global view)
  const visibleClients = clients.filter(c => isAdmin || c.area_id === profile?.area_id);

  // Search filter
  const filtered = visibleClients.filter(c => 
    (c.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  // Get details for selected client
  const clientCases = cases.filter(c => c.client_id === selectedClient?.id);
  const clientCaseIds = clientCases.map(c => c.id);
  const clientTasks = tasks.filter(t => t.case_id && clientCaseIds.includes(t.case_id));
  const clientDocs = docs.filter(d => d.case_id && clientCaseIds.includes(d.case_id));

  const initials = (name) => name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "·";

  const viewDetails = (client) => {
    setSelectedClient(client);
    setDetailModalOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY, area_id: profile?.area_id || "" });
    setFormModalOpen(true);
  };

  const openEdit = (client, e) => {
    e.stopPropagation();
    setEditingId(client.id);
    setForm({
      full_name: client.full_name || "",
      email: client.email || "",
      phone: client.phone || "",
      area_id: client.area_id || "",
      user_id: client.user_id || ""
    });
    setFormModalOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        area_id: form.area_id || null,
        user_id: form.user_id || null
      };

      if (editingId) {
        await supabase.from('clients').update(payload).eq('id', editingId);
      } else {
        await supabase.from('clients').insert([payload]);
      }
      setFormModalOpen(false);
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const remove = async (client, e) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar al cliente "${client.full_name}"? Sus casos asociados quedarán sin cliente asignado.`)) return;
    try {
      await supabase.from('clients').delete().eq('id', client.id);
      load();
    } catch (e) { console.error(e); }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  if (!permissions?.can_view_clients) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#F5F5F3]/30">
        <Users size={40} className="mb-3 opacity-20" />
        <p className="text-sm font-medium">Acceso Denegado</p>
        <p className="text-xs opacity-50 mt-1">No tienes permisos para ver este módulo.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title="Clientes" 
        subtitle={`${visibleClients.length} clientes registrados`} 
        action={
          permissions?.can_create_clients && (
            <button onClick={openNew} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
              <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
              <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2"><Plus size={15} /> Registrar Cliente</span>
            </button>
          )
        }
      />

      <div className="mb-6 relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F5F5F3]/20" />
        <input 
          className="w-full bg-[#080808] border border-[#1A1A1A] pl-11 pr-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors" 
          placeholder="Buscar cliente por nombre o email…" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando clientes…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
          {filtered.map((c) => (
            <div 
              key={c.id} 
              onClick={() => viewDetails(c)} 
              className="bg-[#080808] border border-[#1A1A1A] p-5 hover:border-[#C9A227]/40 cursor-pointer transition-colors group relative"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-11 h-11 bg-[#C9A227]/10 border border-[#C9A227]/20 flex items-center justify-center text-[#C9A227] text-sm font-semibold flex-shrink-0">
                  {initials(c.full_name)}
                </div>
                <div className="min-w-0 flex-1 pr-8">
                  <p className="text-[#F5F5F3] text-sm font-medium group-hover:text-[#C9A227] transition-colors truncate">{c.full_name}</p>
                  <p className="text-[#F5F5F3]/30 text-[10px] mt-0.5">
                    Área: {areas.find(a => a.id === c.area_id)?.name || <span className="italic opacity-50">Sin Área</span>}
                  </p>
                  {c.user_id && (
                    <span className="inline-flex items-center gap-1 text-[8px] text-green-400 bg-green-400/5 px-1.5 py-0.5 border border-green-400/10 mt-1 font-mono">
                      <Link size={8} /> Cuenta Vinculada
                    </span>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4">
                  {permissions?.can_edit_clients && (
                    <button onClick={(e) => openEdit(c, e)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"><Pencil size={13} /></button>
                  )}
                  {permissions?.can_delete_clients && (
                    <button onClick={(e) => remove(c, e)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              
              <div className="space-y-1.5 text-[11px] text-[#F5F5F3]/40 border-t border-[#1A1A1A]/50 pt-3">
                {c.email && <span className="flex items-center gap-1.5 truncate"><Mail size={11} />{c.email}</span>}
                {c.phone && <span className="flex items-center gap-1.5"><Phone size={11} />{c.phone}</span>}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 border border-[#1A1A1A]">
              <Users size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" />
              <p className="text-[#F5F5F3]/20 text-sm">Sin resultados de clientes</p>
            </div>
          )}
        </div>
      )}

      {/* Form Modal for Creating/Editing Clients */}
      <Modal open={formModalOpen} onClose={() => setFormModalOpen(false)} title={editingId ? "Editar Cliente" : "Registrar Cliente"}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Nombre del Cliente</label>
            <input className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ej. Juan Pérez López" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Correo Electrónico</label>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+52 55 1234 5678" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Área (Oficina/División)</label>
            <select 
              className={inputCls} 
              value={form.area_id} 
              onChange={(e) => setForm({ ...form, area_id: e.target.value })}
              disabled={!isAdmin}
            >
              <option value="">Seleccionar área...</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Vincular Cuenta de Usuario</label>
            <select 
              className={inputCls} 
              value={form.user_id} 
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
            >
              <option value="">Sin vinculación a usuario</option>
              {profiles.filter(p => !clients.some(c => c.user_id === p.id && c.id !== editingId)).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
              ))}
            </select>
            <span className="text-[10px] text-[#F5F5F3]/30 mt-1 block">Permite asociar este registro con un usuario activo con rol de Cliente para que pueda ver sus expedientes al iniciar sesión.</span>
          </div>

          <button 
            onClick={submit} 
            disabled={!form.full_name || saving} 
            className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors"
          >
            {saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Crear Cliente"}
          </button>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal 
        open={detailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        title="Expediente del Cliente"
        maxWidth="max-w-4xl"
      >
        {selectedClient && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#1A1A1A] gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#C9A227] flex items-center justify-center text-[#080808] text-lg font-semibold">
                  {initials(selectedClient.full_name)}
                </div>
                <div>
                  <h3 className="text-[#F5F5F3] text-lg font-heading">{selectedClient.full_name}</h3>
                  <p className="text-[#F5F5F3]/30 text-xs mt-0.5">Cliente · Área: {areas.find(a => a.id === selectedClient.area_id)?.name || "Sin Área"}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-[#F5F5F3]/50">
                {selectedClient.email && <p className="flex items-center gap-1.5"><Mail size={12} /> {selectedClient.email}</p>}
                {selectedClient.phone && <p className="flex items-center gap-1.5"><Phone size={12} /> {selectedClient.phone}</p>}
              </div>
            </div>

            {/* Client File Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Cases */}
              <div className="lg:col-span-1 bg-[#080808] border border-[#1A1A1A] p-4 flex flex-col h-[320px]">
                <div className="flex items-center gap-2 mb-3 border-b border-[#1A1A1A] pb-2 flex-shrink-0">
                  <Briefcase size={15} className="text-[#C9A227]" />
                  <h4 className="text-[#F5F5F3]/70 text-xs tracking-wider uppercase">Casos ({clientCases.length})</h4>
                </div>
                <div className="space-y-2 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  {clientCases.map(c => (
                    <div key={c.id} className="p-3 bg-[#0F0F0F] border border-[#1A1A1A]">
                      <p className="text-[#F5F5F3] text-xs font-semibold truncate">{c.title}</p>
                      <p className="text-[#F5F5F3]/30 text-[9px] font-mono mt-0.5">{c.case_number}</p>
                      <span className="inline-block text-[8px] tracking-wider uppercase px-1.5 py-0.5 border border-[#C9A227]/20 text-[#C9A227] bg-[#C9A227]/5 mt-2">Activo</span>
                    </div>
                  ))}
                  {clientCases.length === 0 && (
                    <p className="text-[#F5F5F3]/20 text-xs italic text-center py-12">Sin casos vinculados</p>
                  )}
                </div>
              </div>

              {/* Tasks & Terms */}
              <div className="lg:col-span-1 bg-[#080808] border border-[#1A1A1A] p-4 flex flex-col h-[320px]">
                <div className="flex items-center gap-2 mb-3 border-b border-[#1A1A1A] pb-2 flex-shrink-0">
                  <CheckSquare size={15} className="text-[#C9A227]" />
                  <h4 className="text-[#F5F5F3]/70 text-xs tracking-wider uppercase">Tareas y Términos ({clientTasks.length})</h4>
                </div>
                <div className="space-y-2 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  {clientTasks.map(t => (
                    <div key={t.id} className="p-3 bg-[#0F0F0F] border border-[#1A1A1A]">
                      <p className="text-[#F5F5F3] text-xs font-medium truncate">{t.title}</p>
                      <div className="flex justify-between items-center mt-2 text-[9px] text-[#F5F5F3]/40">
                        <span>{cap(t.status)}</span>
                        {t.due_date && <span>Vence: {new Date(t.due_date).toLocaleDateString("es")}</span>}
                      </div>
                    </div>
                  ))}
                  {clientTasks.length === 0 && (
                    <p className="text-[#F5F5F3]/20 text-xs italic text-center py-12">Sin tareas pendientes</p>
                  )}
                </div>
              </div>

              {/* Documents */}
              <div className="lg:col-span-1 bg-[#080808] border border-[#1A1A1A] p-4 flex flex-col h-[320px]">
                <div className="flex items-center gap-2 mb-3 border-b border-[#1A1A1A] pb-2 flex-shrink-0">
                  <FileText size={15} className="text-[#C9A227]" />
                  <h4 className="text-[#F5F5F3]/70 text-xs tracking-wider uppercase">Documentos ({clientDocs.length})</h4>
                </div>
                <div className="space-y-2 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  {clientDocs.map(d => (
                    <div key={d.id} className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-[#F5F5F3] text-xs truncate">{d.title}</p>
                        <p className="text-[#F5F5F3]/30 text-[8px] mt-0.5">{d.doc_type}</p>
                      </div>
                      {d.file_url && (
                        <a 
                          href={d.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#C9A227] hover:underline text-[9px] uppercase tracking-wider font-semibold flex-shrink-0 mt-0.5"
                        >
                          Ver
                        </a>
                      )}
                    </div>
                  ))}
                  {clientDocs.length === 0 && (
                    <p className="text-[#F5F5F3]/20 text-xs italic text-center py-12">Sin documentos subidos</p>
                  )}
                </div>
              </div>

            </div>

            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => setDetailModalOpen(false)} 
                className="w-full border border-[#1A1A1A] text-[#F5F5F3]/40 text-xs tracking-wider uppercase px-4 py-3 hover:text-[#F5F5F3] transition-colors"
              >
                Cerrar Expediente
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
