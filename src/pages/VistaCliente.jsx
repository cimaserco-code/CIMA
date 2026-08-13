import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Briefcase, FileText, Calendar, Eye, User, Mail, Phone, Users, Download, Info } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import { useAuth } from "@/lib/AuthContext";

export default function VistaCliente() {
  const { profile } = useAuth();
  const isAdminOrStaff = ["Admin", "Direccion General", "Direccion de Area", "Usuario"].includes(profile?.role);

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientData, setClientData] = useState(null);
  
  // Data for the active client
  const [cases, setCases] = useState([]);
  const [docs, setDocs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load client dropdown if admin
  useEffect(() => {
    if (isAdminOrStaff) {
      (async () => {
        const { data } = await supabase.from("clients").select("*").order("full_name");
        if (data) {
          setClients(data);
          if (data.length > 0) {
            setSelectedClientId(data[0].id);
          }
        }
      })();
    } else {
      // If client, fetch their specific client record mapped to their profiles.id
      (async () => {
        setLoading(true);
        const { data: clData } = await supabase
          .from("clients")
          .select("*")
          .eq("user_id", profile?.id)
          .single();
        if (clData) {
          setClientData(clData);
          loadClientDetails(clData.id);
        } else {
          setLoading(false);
        }
      })();
    }
  }, [profile, isAdminOrStaff]);

  // Load details when admin selects a client
  useEffect(() => {
    if (isAdminOrStaff && selectedClientId) {
      const cl = clients.find(c => c.id === selectedClientId);
      setClientData(cl || null);
      loadClientDetails(selectedClientId);
    }
  }, [selectedClientId, clients, isAdminOrStaff]);

  const loadClientDetails = async (clientId) => {
    setLoading(true);
    try {
      // 1. Fetch cases linked to this client
      const { data: cData } = await supabase.from("cases").select("*").eq("client_id", clientId);
      const caseIds = cData ? cData.map(c => c.id) : [];
      setCases(cData || []);

      if (caseIds.length > 0) {
        // 2. Fetch documents for these cases
        const { data: dData } = await supabase.from("documents").select("*").in("case_id", caseIds);
        setDocs(dData || []);

        // 3. Fetch events for these cases
        const { data: eData } = await supabase.from("calendar_events").select("*").in("case_id", caseIds);
        setEvents(eData || []);
      } else {
        setDocs([]);
        setEvents([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = { 
    activo: "text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/20", 
    en_proceso: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", 
    en_espera: "text-[#F5F5F3]/40 bg-[#F5F5F3]/5 border-[#1A1A1A]",
    cerrado: "text-green-400 bg-green-400/10 border-green-400/20",
    archivado: "text-[#F5F5F3]/20 bg-[#F5F5F3]/5 border-[#1A1A1A]"
  };

  const formatLawyers = (lwList) => {
    if (!lwList) return "Sin asignar";
    if (Array.isArray(lwList)) {
      return lwList.length > 0 ? lwList.join(", ") : "Sin asignar";
    }
    return lwList;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Portal de Cliente" 
        subtitle={isAdminOrStaff ? "Previsualización administrativa de la vista del cliente" : "Consulta tus expedientes, documentos y horario de citas"} 
      />

      {/* Admin selection header */}
      {isAdminOrStaff && (
        <div className="bg-[#080808] border border-[#1A1A1A] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[#F5F5F3]/60 uppercase tracking-wider font-semibold">
            <Eye size={16} className="text-[#C9A227]" />
            Modo Previsualización para Administradores
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#F5F5F3]/40">Ver portal del cliente:</span>
            <select 
              value={selectedClientId} 
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-[#0F0F0F] border border-[#1A1A1A] text-[#F5F5F3] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
              {clients.length === 0 && <option value="">Sin clientes registrados</option>}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[#F5F5F3]/30 text-sm">Cargando información del cliente...</p>
      ) : clientData ? (
        <div className="space-y-6">
          
          {/* Welcome Info Card */}
          <div className="bg-[#080808] border border-[#1A1A1A] p-6 relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <User size={200} className="text-[#C9A227]" />
            </div>
            <h2 className="text-[#F5F5F3] text-lg sm:text-xl font-heading tracking-wide">
              Expediente de <span className="text-[#C9A227]">{clientData.full_name}</span>
            </h2>
            <div className="text-[#F5F5F3]/40 text-xs mt-3 flex flex-wrap gap-4">
              {clientData.email && <span className="flex items-center gap-1.5"><Mail size={12} /> {clientData.email}</span>}
              {clientData.phone && <span className="flex items-center gap-1.5"><Phone size={12} /> {clientData.phone}</span>}
            </div>
          </div>

          {/* Two-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Cases & Assigned Lawyers */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#080808] border border-[#1A1A1A] p-6 flex flex-col min-h-[400px]">
                <div className="flex items-center gap-2 mb-4 border-b border-[#1A1A1A] pb-3 flex-shrink-0">
                  <Briefcase size={16} className="text-[#C9A227]" />
                  <h3 className="text-[#F5F5F3] text-sm font-heading tracking-wide">Mis Casos y Abogados Asignados ({cases.length})</h3>
                </div>
                
                <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                  {cases.map(c => (
                    <div key={c.id} className="p-5 bg-[#0F0F0F] border border-[#1A1A1A] space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h4 className="text-[#F5F5F3] text-sm font-semibold">{c.title}</h4>
                          <p className="text-[#F5F5F3]/30 text-[10px] font-mono mt-0.5">Expediente: {c.case_number}</p>
                        </div>
                        <span className={`text-[8px] tracking-wider uppercase px-2 py-0.5 border ${statusColors[c.status] || "text-[#F5F5F3]/40 bg-[#F5F5F3]/5 border-[#1A1A1A]"}`}>{c.status}</span>
                      </div>

                      {c.description && (
                        <p className="text-[#F5F5F3]/60 text-xs leading-relaxed border-t border-[#1A1A1A]/50 pt-3">{c.description}</p>
                      )}

                      <div className="flex items-start gap-2.5 bg-[#080808] p-3 border border-[#1A1A1A] text-xs">
                        <Users size={14} className="text-[#C9A227] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[#F5F5F3]/40 text-[9px] uppercase tracking-wider font-bold">Abogado(s) de Cabecera</p>
                          <p className="text-[#F5F5F3]/80 mt-1 font-medium">{formatLawyers(c.assigned_lawyers)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {cases.length === 0 && (
                    <div className="text-center py-20 text-[#F5F5F3]/20 text-xs italic">No tienes casos o expedientes vinculados en este momento.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Schedule & Shared Documents */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Horario (Calendar/Schedule) */}
              <div className="bg-[#080808] border border-[#1A1A1A] p-6 flex flex-col h-[280px]">
                <div className="flex items-center gap-2 mb-3 border-b border-[#1A1A1A] pb-2 flex-shrink-0">
                  <Calendar size={15} className="text-[#C9A227]" />
                  <h3 className="text-[#F5F5F3] text-xs tracking-wider uppercase">Mi Horario (Próximas Citas)</h3>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  {events.map(e => (
                    <div key={e.id} className="p-3 bg-[#0F0F0F] border border-[#1A1A1A]">
                      <p className="text-[#F5F5F3] text-xs font-medium">{e.title}</p>
                      <p className="text-[#C9A227] text-[9px] tracking-wider uppercase mt-1">
                        {new Date(e.event_date).toLocaleDateString("es", { day: 'numeric', month: 'long' })}
                        {e.event_time ? ` · ${e.event_time}` : ""}
                      </p>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <div className="text-center py-12 text-[#F5F5F3]/20 text-xs italic">Sin audiencias o citas agendadas</div>
                  )}
                </div>
              </div>

              {/* Shared Documents */}
              <div className="bg-[#080808] border border-[#1A1A1A] p-6 flex flex-col h-[280px]">
                <div className="flex items-center gap-2 mb-3 border-b border-[#1A1A1A] pb-2 flex-shrink-0">
                  <FileText size={15} className="text-[#C9A227]" />
                  <h3 className="text-[#F5F5F3] text-xs tracking-wider uppercase">Mis Documentos</h3>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  {docs.map(d => (
                    <div key={d.id} className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="text-[#F5F5F3] text-xs truncate font-medium">{d.title}</p>
                        <p className="text-[#F5F5F3]/30 text-[8px] mt-0.5">{cap(d.doc_type)} · {new Date(d.created_at).toLocaleDateString("es")}</p>
                      </div>
                      {d.file_url && (
                        <a 
                          href={d.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#C9A227] hover:text-[#A8841D] transition-colors p-1 flex-shrink-0"
                          title="Descargar Documento"
                        >
                          <Download size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                  {docs.length === 0 && (
                    <div className="text-center py-12 text-[#F5F5F3]/20 text-xs italic">Sin documentos cargados</div>
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      ) : (
        <div className="bg-[#080808] border border-[#1A1A1A] p-10 text-center text-[#F5F5F3]/30">
          <Info size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Ficha no vinculada</p>
          <p className="text-xs opacity-50 mt-1 max-w-md mx-auto">Este perfil de usuario no está enlazado a ningún registro de cliente. Si eres administrador, ve al módulo de Clientes y asóciale una cuenta de usuario.</p>
        </div>
      )}
    </div>
  );
}
