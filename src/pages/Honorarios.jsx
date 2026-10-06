import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, DollarSign, Calendar, Pencil, Trash2, CheckCircle2, AlertCircle, FileText, Upload, Download, ExternalLink, BellRing, Building2, Briefcase } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";
import { logActivity } from "@/lib/activityLogger";
import { createNotification } from "@/lib/notificationService";
import { toast } from "@/components/ui/use-toast";
import { isResourceInUserArea, BLP_AREA_ID, getAreaCategory } from "@/lib/areaPermissions";

const STATUSES = ["pendiente", "pagado", "cancelado"];
const statusColors = { 
  pendiente: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", 
  pagado: "text-green-400 bg-green-400/10 border-green-400/20", 
  cancelado: "text-[#F5F5F3]/20 bg-[#F5F5F3]/5 border-[#1A1A1A]" 
};

export function parseFeeMetadata(description) {
  if (!description || typeof description !== "string") return {};
  const match = description.match(/<!--\s*fee_meta:([\s\S]*?)\s*-->/i);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error("Error parsing fee metadata:", e);
    }
  }
  return {};
}

export function cleanFeeDescription(description) {
  if (!description || typeof description !== "string") return "";
  return description.replace(/<!--\s*fee_meta:[\s\S]*?-->\s*/gi, "").trim();
}

export function injectFeeMetadata(description, meta) {
  const clean = cleanFeeDescription(description);
  if (!meta || Object.keys(meta).length === 0) return clean;
  return `<!-- fee_meta:${JSON.stringify(meta)} -->\n${clean}`.trim();
}

const EMPTY = { 
  case_id: "", 
  client_id: "", 
  lawyer_id: "", 
  amount: "", 
  description: "", 
  status: "pendiente", 
  due_date: "",
  fee_mode: "litigio", // "litigio" | "blp"
  is_litigio_estrategico: false,
  payment_day: "5",
  invoice_url: "",
  invoice_name: ""
};

export default function Honorarios() {
  const { user, profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;
  const userAreaCat = getAreaCategory(profile?.area_id);
  const isDefaultBLP = userAreaCat === "blp";

  const [activeTab, setActiveTab] = useState(isDefaultBLP ? "blp" : "litigio"); // "litigio" | "blp"
  const [fees, setFees] = useState([]);
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAreaId, setFilterAreaId] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [fRes, cRes, clRes, pRes, aRes] = await Promise.all([
        supabase.from('fees').select('*').order('created_at', { ascending: false }),
        supabase.from('cases').select('*'),
        supabase.from('clients').select('*').order('full_name'),
        supabase.from('profiles').select('*'),
        supabase.from('areas').select('*').order('name')
      ]);
      if (fRes.data) setFees(fRes.data);
      if (cRes.data) setCases(cRes.data);
      if (clRes.data) setClients(clRes.data);
      if (pRes.data) setProfiles(pRes.data);
      if (aRes.data) setAreas(aRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filter cases and clients strictly by Area partition
  const visibleCases = cases.filter(c => isAdmin || c.area_id === profile?.area_id);
  const visibleClients = clients.filter(cl => isAdmin || cl.area_id === profile?.area_id);

  // Fees partition:
  // - Litigio fees are attached to visible cases.
  // - BLP fees can be attached to clients or BLP cases.
  const visibleFees = fees.filter(f => {
    if (isAdmin) return true;
    const meta = parseFeeMetadata(f.description);
    if (meta.fee_mode === "blp" || meta.client_id) {
      if (meta.client_id) {
        const cl = clients.find(c => c.id === meta.client_id);
        return cl ? (cl.area_id === profile?.area_id || cl.area_id === BLP_AREA_ID) : true;
      }
      return profile?.area_id === BLP_AREA_ID;
    }
    return visibleCases.some(c => c.id === f.case_id);
  });

  // Split into Litigio vs BLP
  const litigioFees = visibleFees.filter(f => {
    const meta = parseFeeMetadata(f.description);
    return meta.fee_mode !== "blp";
  });

  const blpFees = visibleFees.filter(f => {
    const meta = parseFeeMetadata(f.description);
    return meta.fee_mode === "blp";
  });

  const activeFees = activeTab === "blp" ? blpFees : litigioFees;

  // Interactive filters
  const filtered = activeFees.filter((f) => {
    const matchesStatus = filterStatus === "all" || f.status === filterStatus;
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

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_factura_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `facturas/${fileName}`;

      const { data, error } = await supabase.storage.from('documents').upload(filePath, file, {
        contentType: file.type || 'application/pdf',
        upsert: true
      });
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      setForm((prev) => ({
        ...prev,
        invoice_url: publicUrlData.publicUrl,
        invoice_name: file.name
      }));
      toast({
        title: "Factura cargada",
        description: `Se adjuntó ${file.name} correctamente.`
      });
    } catch (err) {
      console.error(err);
      alert("Error al subir factura a Storage: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const openNew = () => { 
    setEditingId(null); 
    setForm({ 
      ...EMPTY, 
      fee_mode: activeTab, 
      status: "pendiente",
      due_date: new Date().toISOString().split('T')[0]
    }); 
    setModalOpen(true); 
  };

  const openEdit = (f) => {
    setEditingId(f.id);
    const meta = parseFeeMetadata(f.description);
    const feeMode = meta.fee_mode || (f.case_id ? "litigio" : "blp");

    setForm({
      case_id: f.case_id || "",
      client_id: meta.client_id || "",
      lawyer_id: f.lawyer_id || "",
      amount: f.amount || "",
      description: cleanFeeDescription(f.description),
      status: f.status || "pendiente",
      due_date: f.due_date || "",
      fee_mode: feeMode,
      is_litigio_estrategico: !!meta.is_litigio_estrategico,
      payment_day: meta.payment_day || "5",
      invoice_url: meta.invoice_url || "",
      invoice_name: meta.invoice_name || ""
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert("Por favor ingresa un monto válido.");
      return;
    }
    if (form.fee_mode === "litigio" && !form.case_id) {
      alert("Por favor selecciona un caso para el cobro de honorario.");
      return;
    }
    if (form.fee_mode === "blp" && !form.client_id) {
      alert("Por favor selecciona el cliente o empresa para la iguala mensual.");
      return;
    }

    setSaving(true);
    try {
      const isBLPMode = form.fee_mode === "blp";
      const clientObj = clients.find(c => c.id === form.client_id);
      
      const meta = {
        fee_mode: form.fee_mode,
        client_id: isBLPMode ? form.client_id : null,
        client_name: isBLPMode && clientObj ? clientObj.full_name : null,
        is_litigio_estrategico: isBLPMode ? form.is_litigio_estrategico : false,
        payment_day: isBLPMode ? form.payment_day : null,
        invoice_url: form.invoice_url || null,
        invoice_name: form.invoice_name || null
      };

      const finalDescription = injectFeeMetadata(form.description, meta);

      // In BLP mode: lawyer_id is null because Reception handles collection.
      // case_id is optional or null unless Litigio Estratégico is linked.
      const payload = {
        case_id: form.case_id || null,
        lawyer_id: isBLPMode ? null : (form.lawyer_id || null),
        amount: parseFloat(form.amount || 0),
        description: finalDescription,
        status: form.status,
        due_date: form.due_date || null,
        payment_date: form.status === "pagado" ? new Date().toISOString().split('T')[0] : null
      };

      let res;
      if (editingId) {
        res = await supabase.from('fees').update(payload).eq('id', editingId);
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "EDITAR",
            module: "Honorarios",
            description: `Actualizó ${isBLPMode ? `iguala de ${clientObj?.full_name || 'cliente'}` : 'honorario'} por ${formatMoney(payload.amount)}`,
            metadata: { fee_id: editingId, amount: payload.amount, status: form.status }
          });
        }
      } else {
        res = await supabase.from('fees').insert([payload]);
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "CREAR",
            module: "Honorarios",
            description: `Registró ${isBLPMode ? `iguala mensual para ${clientObj?.full_name || 'cliente'}` : 'honorario'} por ${formatMoney(payload.amount)}`,
            metadata: { amount: payload.amount, status: form.status }
          });
        }
      }

      if (res?.error) throw res.error;

      setModalOpen(false); 
      setForm(EMPTY); 
      setEditingId(null); 
      load();
    } catch (e) { 
      console.error(e); 
      alert("Error al guardar honorario: " + (e.message || JSON.stringify(e)));
    }
    finally { setSaving(false); }
  };

  const markPaid = async (f) => {
    try {
      await supabase.from('fees').update({ 
        status: "pagado", 
        payment_date: new Date().toISOString().split('T')[0] 
      }).eq('id', f.id);
      load();
      toast({
        title: "Cobro registrado",
        description: `Honorario de ${formatMoney(f.amount)} marcado como pagado.`
      });
    } catch (e) { console.error(e); }
  };

  const notifyReceptionAlert = (f) => {
    const meta = parseFeeMetadata(f.description);
    const clientName = meta.client_name || clients.find(c => c.id === meta.client_id)?.full_name || "Cliente BLP";
    const amountStr = formatMoney(f.amount);
    const dayStr = meta.payment_day ? `Día de corte: ${meta.payment_day} de cada mes` : "";

    createNotification({
      recipientName: "Recepción",
      type: "honorario",
      title: `Alerta de Pago de Iguala: ${clientName}`,
      message: `Recordatorio de cobranza para Recepción: ${clientName} (${amountStr}). ${dayStr}. Factura ${meta.invoice_name ? 'adjunta' : 'pendiente'}.`,
      link: "/honorarios",
      metadata: { fee_id: f.id, client: clientName, amount: f.amount }
    });

    logActivity({
      userId: user?.id,
      userName: profile?.full_name || user?.email || "Usuario",
      userEmail: user?.email,
      action: "ALERTA",
      module: "Honorarios",
      description: `Envió alerta de cobranza a Recepción para ${clientName} (${amountStr})`,
      metadata: { fee_id: f.id, amount: f.amount }
    });

    toast({
      title: "Notificación de pago generada",
      description: `Se alertó a Recepción sobre la cobranza de la iguala de ${clientName}.`
    });
  };

  const remove = async (f) => {
    if (!confirm(`¿Eliminar el registro por ${formatMoney(f.amount)}?`)) return;
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
      <PageHeader 
        title="Honorarios e Igualas" 
        subtitle={activeTab === "blp" ? "Control de igualas mensuales por cliente (Área BLP / Cobranza Recepción)" : "Facturación y cobros de honorarios por asunto (Litigio)"} 
        action={
          permissions?.can_create_fees && (
            <button onClick={openNew} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2 font-medium">
              <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
              <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2">
                <Plus size={15} /> {activeTab === "blp" ? "Registrar Iguala Mensual" : "Registrar Honorario"}
              </span>
            </button>
          )
        } 
      />

      {/* Mode / Area Tabs */}
      <div className="flex border-b border-[#1A1A1A] gap-1 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("litigio")}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-wider transition-colors border-b-2 font-medium ${
            activeTab === "litigio"
              ? "border-[#C9A227] text-[#C9A227]"
              : "border-transparent text-[#F5F5F3]/40 hover:text-[#F5F5F3]"
          }`}
        >
          <Briefcase size={14} />
          <span>Honorarios por Asunto (Litigio)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#141414] text-[#F5F5F3]/50 rounded-sm">
            {litigioFees.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("blp")}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-wider transition-colors border-b-2 font-medium ${
            activeTab === "blp"
              ? "border-[#C9A227] text-[#C9A227]"
              : "border-transparent text-[#F5F5F3]/40 hover:text-[#F5F5F3]"
          }`}
        >
          <Building2 size={14} />
          <span>Igualas Mensuales BLP (Por Cliente)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#141414] text-[#F5F5F3]/50 rounded-sm">
            {blpFees.length}
          </span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[2px] mb-8 bg-[#1A1A1A] border border-[#1A1A1A]">
        <div className="bg-[#080808] p-5">
          <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">
            {activeTab === "blp" ? "Igualas Pendientes de Cobro" : "Honorarios Pendientes"}
          </span>
          <p className="text-yellow-400 text-2xl font-heading font-light mt-2">{formatMoney(totalPending)}</p>
        </div>
        <div className="bg-[#080808] p-5">
          <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">
            {activeTab === "blp" ? "Igualas Cobradas / Al Corriente" : "Honorarios Cobrados"}
          </span>
          <p className="text-green-400 text-2xl font-heading font-light mt-2">{formatMoney(totalPaid)}</p>
        </div>
        <div className="bg-[#080808] p-5">
          <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">
            Total en Vista
          </span>
          <p className="text-[#C9A227] text-2xl font-heading font-light mt-2">{formatMoney(totalGeneral)}</p>
        </div>
      </div>

      {/* Informational Callout for BLP */}
      {activeTab === "blp" && (
        <div className="mb-6 p-4 bg-[#0A0A0A] border border-[#1E1E1E] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <Building2 size={16} className="text-[#C9A227] flex-shrink-0" />
            <p className="text-[#F5F5F3]/80">
              <span className="text-[#F5F5F3] font-semibold">Operación de Blindaje Legal Preventivo:</span> Las igualas se registran por cliente/empresa con día de pago fijado. La cobranza la coordina Recepción y se puede adjuntar la factura mensual en PDF o XML.
            </p>
          </div>
          <span className="text-[10px] text-[#C9A227] border border-[#C9A227]/30 bg-[#C9A227]/10 px-2 py-0.5 rounded-sm font-medium">
            Cobranza en Recepción
          </span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
          <option value="all">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        {isAdmin && activeTab === "litigio" && (
          <select value={filterAreaId} onChange={(e) => setFilterAreaId(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#C9A227] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
            <option value="all">Todas las áreas (Oficinas)</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {/* List */}
      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando registros…</p> : (
        <div className="bg-[#080808] border border-[#1A1A1A]">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#1A1A1A] bg-[#0F0F0F]/30 text-[10px] tracking-wider uppercase text-[#F5F5F3]/40">
            <span className="col-span-3">{activeTab === "blp" ? "Cliente / Empresa (BLP)" : "Caso / Expediente"}</span>
            <span className="col-span-3">{activeTab === "blp" ? "Día de Pago & Modalidad" : "Abogado / Concepto"}</span>
            <span className="col-span-2">{activeTab === "blp" ? "Monto Iguala Mensual" : "Monto"}</span>
            <span className="col-span-2">{activeTab === "blp" ? "Factura del Mes" : "Vencimiento"}</span>
            <span className="col-span-2 text-right">Acciones</span>
          </div>

          {filtered.map((f) => {
            const meta = parseFeeMetadata(f.description);
            const isBLPFee = meta.fee_mode === "blp";
            const caseObj = cases.find(c => c.id === f.case_id);
            const clientObj = clients.find(c => c.id === meta.client_id) || (caseObj ? clients.find(c => c.id === caseObj.client_id) : null);
            const lawyerObj = profiles.find(p => p.id === f.lawyer_id);

            // Check if overdue
            const isPending = f.status === "pendiente";
            let isOverdue = false;
            if (isPending) {
              if (f.due_date && new Date(f.due_date) < new Date()) {
                isOverdue = true;
              } else if (meta.payment_day) {
                const todayDay = new Date().getDate();
                if (todayDay > parseInt(meta.payment_day, 10)) {
                  isOverdue = true;
                }
              }
            }

            return (
              <div key={f.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-4 border-b border-[#1A1A1A] last:border-0 items-center hover:bg-[#0F0F0F] transition-colors">
                {/* Columna 1: Sujeto / Caso */}
                <div className="md:col-span-3 min-w-0">
                  {isBLPFee ? (
                    <div>
                      <p className="text-[#F5F5F3] text-sm font-semibold truncate flex items-center gap-1.5">
                        <Building2 size={13} className="text-[#C9A227] flex-shrink-0" />
                        {clientObj?.full_name || meta.client_name || "Cliente Corporativo"}
                      </p>
                      {meta.is_litigio_estrategico && caseObj && (
                        <p className="text-[#C9A227]/70 text-[10px] mt-0.5 truncate">
                          Litigio Estratégico: {caseObj.title}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-[#F5F5F3] text-sm font-medium truncate">{caseObj?.title || "Sin caso"}</p>
                      <p className="text-[#F5F5F3]/30 text-[10px] font-mono mt-0.5">{caseObj?.case_number || "—"}</p>
                    </div>
                  )}
                </div>

                {/* Columna 2: Modalidad / Abogado */}
                <div className="md:col-span-3 min-w-0">
                  {isBLPFee ? (
                    <div>
                      <p className="text-[#F5F5F3]/90 text-xs font-medium flex items-center gap-1.5">
                        <Calendar size={12} className="text-[#C9A227]" />
                        Día de pago: <span className="text-[#C9A227] font-semibold">{meta.payment_day ? `Día ${meta.payment_day} del mes` : "Por definir"}</span>
                      </p>
                      <p className="text-[#F5F5F3]/30 text-[10px] mt-0.5">
                        {meta.is_litigio_estrategico ? "Coordinación Litigio Estratégico" : "Iguala Mensual Preventiva"} · Recepción
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[#F5F5F3]/80 text-xs truncate">{f.description || "Cobro de Honorario"}</p>
                      <p className="text-[#F5F5F3]/30 text-[10px] mt-0.5">Resp: {lawyerObj?.full_name || "Sin asignar"}</p>
                    </div>
                  )}
                </div>

                {/* Columna 3: Monto & Estado */}
                <div className="md:col-span-2">
                  <p className="text-[#F5F5F3] text-sm font-semibold">{formatMoney(f.amount)}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-block text-[9px] tracking-wider uppercase px-2 py-0.5 border ${statusColors[f.status] || ""}`}>
                      {f.status}
                    </span>
                    {isOverdue && (
                      <span className="text-[8px] uppercase tracking-wider text-red-400 bg-red-400/10 px-1.5 py-0.5 border border-red-400/20 font-bold" title="Fecha o día de pago vencido">
                        Vencido
                      </span>
                    )}
                  </div>
                </div>

                {/* Columna 4: Factura o Vencimiento */}
                <div className="md:col-span-2 text-xs">
                  {isBLPFee ? (
                    meta.invoice_url ? (
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} className="text-[#C9A227] flex-shrink-0" />
                        <a 
                          href={meta.invoice_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#C9A227] hover:underline text-[11px] truncate max-w-[120px]"
                          title={meta.invoice_name || "Ver factura"}
                        >
                          {meta.invoice_name || "Factura del mes"}
                        </a>
                      </div>
                    ) : (
                      <span className="text-[#F5F5F3]/30 text-[10px] italic">Sin factura cargada</span>
                    )
                  ) : (
                    f.due_date ? (
                      <p className="text-[#F5F5F3]/60 flex items-center gap-1.5"><Calendar size={11} /> {new Date(f.due_date).toLocaleDateString("es")}</p>
                    ) : <p className="text-[#F5F5F3]/20">—</p>
                  )}
                </div>

                {/* Columna 5: Acciones */}
                <div className="md:col-span-2 flex items-center md:justify-end gap-2 flex-wrap">
                  {/* Botón Alerta de pago para Recepción */}
                  {isBLPFee && isPending && (
                    <button
                      type="button"
                      onClick={() => notifyReceptionAlert(f)}
                      className="p-1 text-[#F5F5F3]/40 hover:text-[#C9A227] transition-colors"
                      title="Enviar alerta de cobranza a Recepción"
                    >
                      <BellRing size={13} />
                    </button>
                  )}

                  {permissions?.can_edit_fees && f.status === "pendiente" && (
                    <button 
                      onClick={() => markPaid(f)} 
                      className="text-[#22C55E]/70 hover:text-[#22C55E] text-[10px] tracking-wider uppercase flex items-center gap-1 transition-colors px-1.5 py-0.5 border border-[#22C55E]/30 bg-[#22C55E]/5"
                      title="Marcar como cobrado"
                    >
                      <CheckCircle2 size={11} /> Cobrar
                    </button>
                  )}

                  {permissions?.can_edit_fees && (
                    <button onClick={() => openEdit(f)} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors" title="Editar">
                      <Pencil size={13} />
                    </button>
                  )}

                  {permissions?.can_delete_fees && (
                    <button onClick={() => remove(f)} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors" title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <DollarSign size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" />
              <p className="text-[#F5F5F3]/30 text-sm">
                {activeTab === "blp" ? "Sin registros de igualas mensuales en BLP" : "Sin registros de honorarios"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal Crear / Editar */}
      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingId 
          ? (form.fee_mode === "blp" ? "Editar Iguala Mensual BLP" : "Editar Honorario") 
          : (form.fee_mode === "blp" ? "Registrar Iguala Mensual BLP" : "Registrar Honorario")
        }
      >
        <div className="space-y-4 text-left">
          {/* Modalidad Selector */}
          <div>
            <label className={labelCls}>Tipo de Cobro</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, fee_mode: "litigio" })}
                className={`py-2 px-3 text-xs uppercase tracking-wider font-medium border text-center transition-colors ${
                  form.fee_mode === "litigio" 
                    ? "bg-[#C9A227] text-[#080808] border-[#C9A227]" 
                    : "bg-[#0F0F0F] text-[#F5F5F3]/50 border-[#1A1A1A] hover:text-[#F5F5F3]"
                }`}
              >
                Honorario por Asunto
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, fee_mode: "blp" })}
                className={`py-2 px-3 text-xs uppercase tracking-wider font-medium border text-center transition-colors ${
                  form.fee_mode === "blp" 
                    ? "bg-[#C9A227] text-[#080808] border-[#C9A227]" 
                    : "bg-[#0F0F0F] text-[#F5F5F3]/50 border-[#1A1A1A] hover:text-[#F5F5F3]"
                }`}
              >
                Iguala Mensual BLP
              </button>
            </div>
          </div>

          {form.fee_mode === "blp" ? (
            /* Campos específicos para BLP */
            <div className="space-y-3.5 pt-1">
              <div>
                <label className={labelCls}>Cliente / Empresa (BLP)</label>
                <select
                  className={inputCls}
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar cliente / empresa...</option>
                  {visibleClients.map((cl) => (
                    <option key={cl.id} value={cl.id}>{cl.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Litigio Estratégico dentro de BLP */}
              <div className="p-3 bg-[#0A0A0A] border border-[#1A1A1A] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#F5F5F3]/80">
                  <input
                    type="checkbox"
                    checked={form.is_litigio_estrategico}
                    onChange={(e) => setForm({ ...form, is_litigio_estrategico: e.target.checked })}
                    className="accent-[#C9A227] w-4 h-4 cursor-pointer"
                  />
                  <span>Coordinación de Litigio Estratégico (Vincular Caso)</span>
                </label>

                {form.is_litigio_estrategico && (
                  <div className="pt-2">
                    <label className={labelCls}>Caso Vinculado a la Iguala</label>
                    <select
                      className={inputCls}
                      value={form.case_id}
                      onChange={(e) => setForm({ ...form, case_id: e.target.value })}
                    >
                      <option value="">Seleccionar caso (opcional)...</option>
                      {visibleCases.map((c) => (
                        <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Monto Iguala Mensual ($ MXN)</label>
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
                  <label className={labelCls}>Día de Pago (Corte Mensual)</label>
                  <select
                    className={inputCls}
                    value={form.payment_day || "5"}
                    onChange={(e) => setForm({ ...form, payment_day: e.target.value })}
                  >
                    {[...Array(31)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>Día {i + 1} de cada mes</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Estado de Pago</label>
                  <select
                    className={inputCls}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Fecha de Vencimiento / Corte</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Carga de Factura del Mes */}
              <div>
                <label className={labelCls}>Factura del Mes (PDF o XML)</label>
                <label className="flex items-center gap-2 border border-dashed border-[#2A2A2A] px-4 py-3 cursor-pointer hover:border-[#C9A227] transition-colors bg-[#0A0A0A]">
                  <Upload size={15} className="text-[#F5F5F3]/30" />
                  <span className="text-[#F5F5F3]/50 text-xs truncate">
                    {form.invoice_name || (form.invoice_url ? "Factura cargada ✓" : uploading ? "Subiendo factura…" : "Cargar factura del mes (PDF / XML)")}
                  </span>
                  <input type="file" accept=".pdf,.xml" className="hidden" onChange={handleInvoiceUpload} />
                </label>
                {form.invoice_url && (
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#C9A227]">
                    <FileText size={11} />
                    <a href={form.invoice_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      Ver archivo cargado
                    </a>
                    <button 
                      type="button" 
                      onClick={() => setForm({ ...form, invoice_url: "", invoice_name: "" })} 
                      className="text-red-400 hover:underline ml-2"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-[#F5F5F3]/40 bg-[#0C0C0C] p-2 border border-[#161616]">
                ℹ️ Sin abogado responsable asignado: el seguimiento de cobranza y facturación de igualas mensuales corresponde a Recepción.
              </p>
            </div>
          ) : (
            /* Campos específicos para Litigio */
            <div className="space-y-3.5 pt-1">
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
            </div>
          )}

          <div>
            <label className={labelCls}>Concepto / Notas Adicionales</label>
            <textarea 
              className={inputCls} 
              rows={2} 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              placeholder={form.fee_mode === "blp" ? "Ej. Iguala mensual corporativa mayo 2026..." : "Ej. Honorarios por contestación de demanda..."} 
            />
          </div>

          <button 
            onClick={submit} 
            disabled={saving || (form.fee_mode === "litigio" && !form.case_id) || (form.fee_mode === "blp" && !form.client_id) || !form.amount} 
            className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors font-medium"
          >
            {saving ? "Guardando…" : editingId ? "Guardar Cambios" : (form.fee_mode === "blp" ? "Registrar Iguala Mensual" : "Registrar Honorario")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
