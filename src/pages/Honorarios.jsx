import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, DollarSign, Calendar, Pencil, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";

const STATUSES = ["pendiente", "pagado", "cancelado"];
const statusColors = { 
  pendiente: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", 
  pagado: "text-green-400 bg-green-400/10 border-green-400/20", 
  cancelado: "text-[#F5F5F3]/20 bg-[#F5F5F3]/5 border-[#1A1A1A]" 
};

const EMPTY = { case_id: "", lawyer_id: "", amount: "", description: "", status: "pendiente", due_date: "" };

export default function Honorarios() {
  const { profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [fees, setFees] = useState([]);
  const [cases, setCases] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAreaId, setFilterAreaId] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [fRes, cRes, pRes, aRes] = await Promise.all([
        supabase.from('fees').select('*').order('created_at', { ascending: false }),
        supabase.from('cases').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('areas').select('*').order('name')
      ]);
      if (fRes.data) setFees(fRes.data);
      if (cRes.data) setCases(cRes.data);
      if (pRes.data) setProfiles(pRes.data);
      if (aRes.data) setAreas(aRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filter cases by Area partition (if not admin/global)
  const visibleCases = cases.filter(c => isAdmin || c.area_id === profile?.area_id);
  // Filter fees based on case visibility
  const visibleFees = fees.filter(f => visibleCases.some(c => c.id === f.case_id));

  // Interactive filters
  const filtered = visibleFees.filter((f) => {
    const matchesStatus = filterStatus === "all" || f.status === filterStatus;
    
    // Find area of this fee's case
    const caseObj = cases.find(c => c.id === f.case_id);
    const matchesArea = filterAreaId === "all" || (caseObj && caseObj.area_id === filterAreaId);

    return matchesStatus && matchesArea;
  });

  // Calculate totals
  const totalPending = filtered.filter(f => f.status === "pendiente").reduce((acc, f) => acc + parseFloat(f.amount || 0), 0);
  const totalPaid = filtered.filter(f => f.status === "pagado").reduce((acc, f) => acc + parseFloat(f.amount || 0), 0);
  const totalGeneral = filtered.reduce((acc, f) => acc + parseFloat(f.amount || 0), 0);

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  };

  const openNew = () => { setEditingId(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (f) => {
    setEditingId(f.id);
    setForm({
      case_id: f.case_id || "",
      lawyer_id: f.lawyer_id || "",
      amount: f.amount || "",
      description: f.description || "",
      status: f.status || "pendiente",
      due_date: f.due_date || ""
    });
    setModalOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        case_id: form.case_id,
        lawyer_id: form.lawyer_id || null,
        amount: parseFloat(form.amount || 0),
        description: form.description,
        status: form.status,
        due_date: form.due_date || null,
        payment_date: form.status === "pagado" ? new Date().toISOString().split('T')[0] : null
      };

      if (editingId) {
        await supabase.from('fees').update(payload).eq('id', editingId);
      } else {
        await supabase.from('fees').insert([payload]);
      }
      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const markPaid = async (f) => {
    try {
      await supabase.from('fees').update({ 
        status: "pagado", 
        payment_date: new Date().toISOString().split('T')[0] 
      }).eq('id', f.id);
      load();
    } catch (e) { console.error(e); }
  };

  const remove = async (f) => {
    if (!confirm(`¿Eliminar el registro de honorario por ${formatMoney(f.amount)}?`)) return;
    try {
      await supabase.from('fees').delete().eq('id', f.id);
      load();
    } catch (e) { console.error(e); }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  if (!permissions?.can_view_fees) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#F5F5F3]/30">
        <DollarSign size={40} className="mb-3 opacity-20" />
        <p className="text-sm font-medium">Acceso Denegado</p>
        <p className="text-xs opacity-50 mt-1">No tienes permisos para ver este módulo.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Honorarios" subtitle="Control de facturación, cobros y pagos de honorarios" action={
        permissions?.can_create_fees && (
          <button onClick={openNew} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
            <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2"><Plus size={15} /> Registrar Honorario</span>
          </button>
        )
      } />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[2px] mb-8 bg-[#1A1A1A] border border-[#1A1A1A]">
        <div className="bg-[#080808] p-5">
          <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">Honorarios Pendientes</span>
          <p className="text-yellow-400 text-2xl font-heading font-light mt-2">{formatMoney(totalPending)}</p>
        </div>
        <div className="bg-[#080808] p-5">
          <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">Honorarios Cobrados</span>
          <p className="text-green-400 text-2xl font-heading font-light mt-2">{formatMoney(totalPaid)}</p>
        </div>
        <div className="bg-[#080808] p-5">
          <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">Total Facturado</span>
          <p className="text-[#C9A227] text-2xl font-heading font-light mt-2">{formatMoney(totalGeneral)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
          <option value="all">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        {isAdmin && (
          <select value={filterAreaId} onChange={(e) => setFilterAreaId(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#C9A227] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
            <option value="all">Todas las áreas (Oficinas)</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {/* List */}
      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando honorarios…</p> : (
        <div className="bg-[#080808] border border-[#1A1A1A]">
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#1A1A1A] bg-[#0F0F0F]/30">
            <span className="col-span-3 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase">Caso / Expediente</span>
            <span className="col-span-3 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase">Abogado / Concepto</span>
            <span className="col-span-2 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase">Monto</span>
            <span className="col-span-2 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase">Vencimiento</span>
            <span className="col-span-2 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase text-right">Acciones</span>
          </div>

          {filtered.map((f) => {
            const caseObj = cases.find(c => c.id === f.case_id);
            const lawyerObj = profiles.find(p => p.id === f.lawyer_id);
            return (
              <div key={f.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-4 border-b border-[#1A1A1A] last:border-0 items-center hover:bg-[#0F0F0F] transition-colors">
                {/* Caso */}
                <div className="md:col-span-3">
                  <p className="text-[#F5F5F3] text-sm font-medium truncate">{caseObj?.title || "Sin caso"}</p>
                  <p className="text-[#F5F5F3]/30 text-[10px] font-mono mt-0.5">{caseObj?.case_number || "—"}</p>
                </div>
                {/* Concepto / Abogado */}
                <div className="md:col-span-3">
                  <p className="text-[#F5F5F3]/80 text-xs truncate">{f.description || "Cobro de Honorario"}</p>
                  <p className="text-[#F5F5F3]/30 text-[10px] mt-0.5">Resp: {lawyerObj?.full_name || "Sin asignar"}</p>
                </div>
                {/* Monto */}
                <div className="md:col-span-2">
                  <p className="text-[#F5F5F3] text-sm font-semibold">{formatMoney(f.amount)}</p>
                  <span className={`inline-block text-[9px] tracking-wider uppercase px-2 py-0.5 mt-1 border ${statusColors[f.status] || ""}`}>{f.status}</span>
                </div>
                {/* Vencimiento */}
                <div className="md:col-span-2">
                  {f.due_date ? (
                    <p className="text-[#F5F5F3]/60 text-xs flex items-center gap-1.5"><Calendar size={11} /> {new Date(f.due_date).toLocaleDateString("es")}</p>
                  ) : <p className="text-[#F5F5F3]/20 text-xs">—</p>}
                </div>
                {/* Acciones */}
                <div className="md:col-span-2 flex items-center md:justify-end gap-3">
                  {permissions?.can_edit_fees && f.status === "pendiente" && (
                    <button 
                      onClick={() => markPaid(f)} 
                      className="text-[#22C55E]/60 hover:text-[#22C55E] text-[10px] tracking-wider uppercase flex items-center gap-1 transition-colors"
                      title="Marcar como cobrado"
                    >
                      <CheckCircle2 size={13} /> Cobrar
                    </button>
                  )}
                  {permissions?.can_edit_fees && (
                    <button onClick={() => openEdit(f)} className="text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"><Pencil size={13} /></button>
                  )}
                  {permissions?.can_delete_fees && (
                    <button onClick={() => remove(f)} className="text-[#F5F5F3]/30 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <DollarSign size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" />
              <p className="text-[#F5F5F3]/20 text-sm">Sin registros de honorarios</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar Honorario" : "Registrar Honorario"}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Caso Vinculado</label>
            <select 
              className={inputCls} 
              value={form.case_id} 
              onChange={(e) => setForm({ ...form, case_id: e.target.value })}
              required
            >
              <option value="">Seleccionar caso...</option>
              {visibleCases.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Abogado Responsable</label>
            <select 
              className={inputCls} 
              value={form.lawyer_id} 
              onChange={(e) => setForm({ ...form, lawyer_id: e.target.value })}
            >
              <option value="">Seleccionar abogado...</option>
              {profiles.filter(p => p.role !== "Cliente").map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Monto ($ MXN)</label>
              <input 
                type="number" 
                step="0.01" 
                className={inputCls} 
                value={form.amount} 
                onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                placeholder="0.00" 
                required
              />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select 
                className={inputCls} 
                value={form.status} 
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Vencimiento</label>
            <input 
              type="date" 
              className={inputCls} 
              value={form.due_date} 
              onChange={(e) => setForm({ ...form, due_date: e.target.value })} 
            />
          </div>

          <div>
            <label className={labelCls}>Concepto / Descripción</label>
            <textarea 
              className={inputCls} 
              rows={2} 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              placeholder="Ej. Cobro de honorarios mensuales de litigio..." 
            />
          </div>

          <button 
            onClick={submit} 
            disabled={!form.case_id || !form.amount || saving} 
            className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors"
          >
            {saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Registrar Honorario"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
