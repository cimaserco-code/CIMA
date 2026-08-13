import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Briefcase, CheckSquare, FileText, Calendar, Eye, User, Mail, Phone } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";

export default function VistaCliente() {
  const { profile } = useAuth();
  const isAdminOrStaff = ["Admin", "Direccion General", "Direccion de Area", "Usuario"].includes(profile?.role);

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientData, setClientData] = useState(null);
  
  // Data for the active client
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
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
        // 2. Fetch tasks for these cases
        const { data: tData } = await supabase.from("tasks").select("*").in("case_id", caseIds);
        setTasks(tData || []);

        // 3. Fetch documents for these cases
        const { data: dData } = await supabase.from("documents").select("*").in("case_id", caseIds);
        setDocs(dData || []);

        // 4. Fetch events for these cases
        const { data: eData } = await supabase.from("calendar_events").select("*").in("case_id", caseIds);
        setEvents(eData || []);
      } else {
        setTasks([]);
        setDocs([]);
        setEvents([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = { activo: "text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/20", en_proceso: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", cerrado: "text-green-400 bg-green-400/10 border-green-400/20" };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Portal de Cliente" 
        subtitle={isAdminOrStaff ? "Previsualización administrativa de la vista del cliente" : "Consulta el estado de tus casos, tareas y expedientes"} 
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
        <p className="text-[#F5F5F3]/30 text-sm">Cargando expediente del cliente...</p>
      ) : clientData ? (
        <div className="space-y-6">
          {/* Welcome and client info card */}
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

          {/* Core modules widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[2px]">
            
            {/* Active Cases */}
            <div className="bg-[#080808] border border-[#1A1A1A] p-6 flex flex-col h-[400px]">
              <div className="flex items-center gap-2 mb-4 border-b border-[#1A1A1A] pb-3 flex-shrink-0">
                <Briefcase size={16} className="text-[#C9A227]" />
                <h3 className="text-[#F5F5F3] text-sm font-heading tracking-wide">Mis Casos Activos ({cases.length})</h3>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                {cases.map(c => (
                  <div key={c.id} className="p-4 bg-[#0F0F0F] border border-[#1A1A1A]">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[#F5F5F3] text-xs font-semibold truncate">{c.title}</p>
                      <span className={`text-[8px] tracking-wider uppercase px-2 py-0.5 border ${statusColors[c.status] || "text-[#F5F5F3]/30 bg-[#F5F5F3]/5 border-[#1A1A1A]"}`}>{c.status}</span>
                    </div>
                    <p className="text-[#F5F5F3]/30 text-[10px] font-mono">No. {c.case_number}</p>
                    {c.description && <p className="text-[#F5F5F3]/50 text-[10px] mt-2 line-clamp-2">{c.description}</p>}
                  </div>
                ))}
                {cases.length === 0 && (
                  <div className="text-center py-16 text-[#F5F5F3]/20 text-xs italic">No tienes casos activos vinculados</div>
                )}
              </div>
            </div>

            {/* Pending Tasks & Events */}
            <div className="bg-[#080808] border border-[#1A1A1A] p-6 flex flex-col h-[400px]">
              <div className="flex items-center gap-2 mb-4 border-b border-[#1A1A1A] pb-3 flex-shrink-0">
                <CheckSquare size={16} className="text-[#C9A227]" />
                <h3 className="text-[#F5F5F3] text-sm font-heading tracking-wide">Tareas y Audiencias ({tasks.length + events.length})</h3>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                {/* Events/Hearings first */}
                {events.map(e => (
                  <div key={e.id} className="p-4 bg-[#0F0F0F] border border-[#C9A227]/20 border-l-2 border-l-[#C9A227]">
                    <span className="text-[8px] tracking-wider uppercase px-1.5 py-0.5 bg-[#C9A227]/10 text-[#C9A227] font-semibold">Evento programado</span>
                    <p className="text-[#F5F5F3] text-xs font-medium mt-1.5">{e.title}</p>
                    <p className="text-[#F5F5F3]/40 text-[9px] mt-1">{new Date(e.event_date).toLocaleDateString("es")} {e.event_time ? ` · ${e.event_time}` : ""}</p>
                  </div>
                ))}

                {/* Next pending tasks */}
                {tasks.map(t => (
                  <div key={t.id} className="p-4 bg-[#0F0F0F] border border-[#1A1A1A]">
                    <p className="text-[#F5F5F3] text-xs font-medium">{t.title}</p>
                    <div className="flex justify-between items-center mt-2 text-[9px] text-[#F5F5F3]/40">
                      <span>Estado: {cap(t.status)}</span>
                      {t.due_date && <span>Límite: {new Date(t.due_date).toLocaleDateString("es")}</span>}
                    </div>
                  </div>
                ))}

                {tasks.length === 0 && events.length === 0 && (
                  <div className="text-center py-16 text-[#F5F5F3]/20 text-xs italic">No hay actividades pendientes en tus expedientes</div>
                )}
              </div>
            </div>

            {/* Shared Documents */}
            <div className="bg-[#080808] border border-[#1A1A1A] p-6 flex flex-col h-[400px]">
              <div className="flex items-center gap-2 mb-4 border-b border-[#1A1A1A] pb-3 flex-shrink-0">
                <FileText size={16} className="text-[#C9A227]" />
                <h3 className="text-[#F5F5F3] text-sm font-heading tracking-wide">Documentos Compartidos ({docs.length})</h3>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                {docs.map(d => (
                  <div key={d.id} className="p-4 bg-[#0F0F0F] border border-[#1A1A1A] flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-[#F5F5F3] text-xs truncate font-medium">{d.title}</p>
                      <p className="text-[#F5F5F3]/30 text-[9px] mt-0.5">{cap(d.doc_type)} · {new Date(d.created_at).toLocaleDateString("es")}</p>
                    </div>
                    {d.file_url && (
                      <a 
                        href={d.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[#C9A227] hover:underline text-[9px] uppercase tracking-wider font-semibold flex-shrink-0"
                      >
                        Descargar
                      </a>
                    )}
                  </div>
                ))}
                {docs.length === 0 && (
                  <div className="text-center py-16 text-[#F5F5F3]/20 text-xs italic">No hay documentos compartidos en este expediente</div>
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="bg-[#080808] border border-[#1A1A1A] p-10 text-center text-[#F5F5F3]/30">
          <User size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Cuenta no vinculada</p>
          <p className="text-xs opacity-50 mt-1 max-w-md mx-auto">Este usuario no está vinculado a una ficha de cliente en el sistema. Pide a un administrador que vincule esta cuenta en el módulo de Clientes.</p>
        </div>
      )}
    </div>
  );
}
