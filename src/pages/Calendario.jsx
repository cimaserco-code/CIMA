import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Calendar as CalIcon, MapPin, Clock, ChevronLeft, ChevronRight, LayoutGrid, List, Pencil, Trash2, Briefcase, Users, FileText, X } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import LawyerSelect from "@/components/legal/LawyerSelect";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";

const TYPES = ["audiencia", "vencimiento_termino", "reunion_interna", "cita_cliente", "diligencia", "recordatorio_general"];
const typeColors = { 
  audiencia: "text-[#C9A227] bg-[#C9A227]/10", 
  vencimiento_termino: "text-red-400 bg-red-400/10", 
  reunion_interna: "text-purple-400 bg-purple-400/10", 
  cita_cliente: "text-green-400 bg-green-400/10", 
  diligencia: "text-blue-400 bg-blue-400/10",
  recordatorio_general: "text-[#F5F5F3]/40 bg-[#F5F5F3]/5"
};
const typeDots = { 
  audiencia: "bg-[#C9A227]", 
  vencimiento_termino: "bg-red-400", 
  reunion_interna: "bg-purple-400", 
  cita_cliente: "bg-green-400", 
  diligencia: "bg-blue-400",
  recordatorio_general: "bg-[#F5F5F3]/40"
};
const typeLabels = {
  audiencia: "Audiencia",
  vencimiento_termino: "Vencimiento o término",
  reunion_interna: "Reunión interna",
  cita_cliente: "Cita con cliente",
  diligencia: "Diligencia",
  recordatorio_general: "Recordatorio general"
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Parse date string (YYYY-MM-DD) into local Date without UTC offset
function parseLocalDate(dateStrOrObj) {
  if (!dateStrOrObj) return new Date();
  if (dateStrOrObj instanceof Date) return dateStrOrObj;
  if (typeof dateStrOrObj === "string") {
    const match = dateStrOrObj.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [_, y, m, d] = match;
      return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    }
  }
  return new Date(dateStrOrObj);
}

function formatDate(d) {
  const parsed = parseLocalDate(d);
  return parsed.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function normalizeTime(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(":");
  if (parts.length >= 2) {
    const hours = parts[0].padStart(2, "0");
    const minutes = parts[1].padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  return String(timeStr).trim();
}

function compareEvents(a, b) {
  // 1. Order by date first
  const dateDiff = parseLocalDate(a.event_date) - parseLocalDate(b.event_date);
  if (dateDiff !== 0) return dateDiff;

  // 2. If same date, order by time (earliest first, e.g. 08:00 before 14:00)
  const tA = normalizeTime(a.event_time);
  const tB = normalizeTime(b.event_time);

  if (tA && tB) {
    const timeDiff = tA.localeCompare(tB);
    if (timeDiff !== 0) return timeDiff;
  } else if (tA && !tB) {
    return -1; // Events with defined time go before events with no time
  } else if (!tA && tB) {
    return 1;
  }

  // 3. Fallback: alphabetical order by title
  return (a.title || "").localeCompare(b.title || "");
}

function getMonthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const dayOfWeek = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - dayOfWeek);
  const weeks = [];
  let cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(row);
  }
  return weeks;
}

const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
const lawyers = (v) => Array.isArray(v) ? (v.length ? v.join(", ") : "—") : (v || "—");

const EMPTY = { title: "", event_type: "audiencia", event_date: "", event_time: "", case_id: "", assigned_lawyers: [], description: "" };

export default function Calendario() {
  const { profile, permissions } = useAuth();
  const isAdmin = !!permissions?.can_view_all_cases;

  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [cases, setCases] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendario");
  const [filterType, setFilterType] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [cursor, setCursor] = useState(new Date());
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [eRes, mRes, cRes, aRes] = await Promise.all([
        supabase.from('calendar_events').select('*').order('event_date', { ascending: true }),
        supabase.from('team_members').select('*'),
        supabase.from('cases').select('*'),
        supabase.from('areas').select('*')
      ]);
      if (eRes.data) setEvents(eRes.data);
      if (mRes.data) setMembers(mRes.data);
      if (cRes.data) setCases(cRes.data);
      if (aRes.data) setAreas(aRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filter cases and events by Area:
  const visibleCases = cases.filter(c => isAdmin || c.area_id === profile?.area_id);
  const visibleEvents = events.filter(e => !e.case_id || visibleCases.some(c => c.id === e.case_id));

  const filtered = filterType === "all" ? visibleEvents : visibleEvents.filter((e) => e.event_type === filterType);
  const allSorted = [...filtered].sort(compareEvents);
  const grouped = allSorted.reduce((acc, e) => { const day = formatDate(e.event_date); if (!acc[day]) acc[day] = []; acc[day].push(e); return acc; }, {});

  const monthMatrix = getMonthMatrix(cursor.getFullYear(), cursor.getMonth());
  const eventsForDay = (date) => filtered.filter((e) => isSameDay(e.event_date, date)).sort(compareEvents);

  // Lawyer area filtering when assigning in modal:
  const selectedCaseForEvent = cases.find(c => c.id === form.case_id);
  const activeEventAreaId = selectedCaseForEvent?.area_id || (!isAdmin ? profile?.area_id : null);
  const eligibleLawyersForEvent = activeEventAreaId
    ? members.filter(m => m.area_id === activeEventAreaId || !m.area_id || ['Admin', 'Direccion General'].includes(m.role))
    : members;

  const openNew = () => { setEditingId(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({ 
      title: e.title || "", 
      event_type: e.event_type || "audiencia", 
      event_date: e.event_date || "", 
      event_time: e.event_time || "", 
      case_id: e.case_id || "", 
      assigned_lawyers: toArray(e.assigned_lawyers), 
      description: e.description || "" 
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      alert("Por favor ingresa un título para el evento.");
      return;
    }
    if (!form.event_date) {
      alert("Por favor selecciona una fecha para el evento.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        event_type: form.event_type,
        event_date: form.event_date,
        event_time: form.event_time || null,
        case_id: form.case_id || null,
        assigned_lawyers: form.assigned_lawyers,
        description: form.description
      };

      let res;
      if (editingId) { 
        res = await supabase.from('calendar_events').update(payload).eq('id', editingId); 
      } else { 
        res = await supabase.from('calendar_events').insert([payload]); 
      }
      if (res.error) throw res.error;

      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { 
      console.error(e); 
      alert("Error al guardar el evento: " + (e.message || JSON.stringify(e)));
    } finally { 
      setSaving(false); 
    }
  };

  const remove = async (e) => {
    if (!confirm(`¿Eliminar el evento "${e.title}"?`)) return;
    try { 
      const { error } = await supabase.from('calendar_events').delete().eq('id', e.id); 
      if (error) throw error;
      if (selectedDay) setSelectedDay(null); 
      if (viewingEvent?.id === e.id) setViewingEvent(null);
      load(); 
    } catch (err) { 
      console.error(err); 
      alert("Error al eliminar evento: " + err.message);
    }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  const renderEventCard = (e) => (
    <div 
      key={e.id} 
      onClick={() => setViewingEvent(e)}
      className="bg-[#0F0F0F] border border-[#1A1A1A] p-4 group cursor-pointer hover:border-[#C9A227]/50 transition-colors text-left"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[9px] tracking-wider uppercase px-2 py-1 font-medium ${typeColors[e.event_type] || ""}`}>
          {typeLabels[e.event_type] || e.event_type}
        </span>
        <div className="flex items-center gap-2">
          {e.event_time && <span className="text-[#F5F5F3]/30 text-[11px] flex items-center gap-1"><Clock size={11} />{e.event_time}</span>}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} className="p-1 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors" title="Editar"><Pencil size={13} /></button>
            <button onClick={(ev) => { ev.stopPropagation(); remove(e); }} className="p-1 text-[#F5F5F3]/30 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
      <p className="text-[#F5F5F3] text-sm mb-2 group-hover:text-[#C9A227] transition-colors font-medium">{e.title}</p>
      <div className="space-y-1 text-[11px] text-[#F5F5F3]/40">
        <p><span className="text-[#F5F5F3]/20">Abogado(s):</span> {lawyers(e.assigned_lawyers)}</p>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Calendario" subtitle={`${filtered.length} eventos`} action={
        <div className="flex items-center gap-2">
          <div className="flex bg-[#080808] border border-[#1A1A1A]">
            <button onClick={() => setView("calendario")} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] tracking-wider uppercase transition-colors ${view === "calendario" ? "bg-[#C9A227] text-[#080808]" : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"}`}><LayoutGrid size={13} /> Calendario</button>
            <button onClick={() => setView("lista")} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] tracking-wider uppercase transition-colors ${view === "lista" ? "bg-[#C9A227] text-[#080808]" : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"}`}><List size={13} /> Lista</button>
          </div>
          <button onClick={openNew} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
            <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2"><Plus size={15} /> Nuevo Evento</span>
          </button>
        </div>
      } />

      <div className="flex flex-wrap gap-2 mb-6">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
          <option value="all">Todos los tipos</option>
          {TYPES.map((t) => <option key={t} value={t}>{typeLabels[t] || t}</option>)}
        </select>
      </div>

      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando eventos…</p> : view === "lista" ? (
        <div className="space-y-8">
          {Object.entries(grouped).map(([day, dayEvents]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-4">
                <CalIcon size={14} className="text-[#C9A227]" />
                <h3 className="text-[#F5F5F3]/60 text-xs tracking-wider uppercase">{day}</h3>
                <div className="flex-1 h-px bg-[#1A1A1A]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
                {dayEvents.map(renderEventCard)}
              </div>
            </div>
          ))}
          {allSorted.length === 0 && <div className="text-center py-16"><CalIcon size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" /><p className="text-[#F5F5F3]/20 text-sm">Sin eventos</p></div>}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#F5F5F3] text-lg font-heading">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 text-[#F5F5F3]/40 hover:text-[#F5F5F3] hover:bg-[#1A1A1A] transition-colors"><ChevronLeft size={16} /></button>
              <button onClick={() => setCursor(new Date())} className="text-[10px] tracking-wider uppercase text-[#F5F5F3]/40 hover:text-[#F5F5F3] px-3 py-2">Hoy</button>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 text-[#F5F5F3]/40 hover:text-[#F5F5F3] hover:bg-[#1A1A1A] transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="bg-[#080808] border border-[#1A1A1A]">
            <div className="grid grid-cols-7 border-b border-[#1A1A1A]">
              {WEEKDAYS.map((d) => <div key={d} className="text-center py-2 text-[10px] tracking-wider uppercase text-[#F5F5F3]/30">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {monthMatrix.flat().map((date, i) => {
                const isCurrentMonth = date.getMonth() === cursor.getMonth();
                const isToday = isSameDay(date, new Date());
                const dayEvents = eventsForDay(date);
                return (
                  <div 
                    key={i} 
                    onClick={() => setSelectedDay(dayEvents.length > 0 ? { date, events: dayEvents } : null)} 
                    className={`min-h-[100px] md:min-h-[120px] border-r border-b border-[#1A1A1A] p-2 cursor-pointer hover:bg-[#0F0F0F] transition-colors ${!isCurrentMonth ? "opacity-30" : ""}`}
                  >
                    <div className={`text-xs mb-1.5 ${isToday ? "bg-[#C9A227] text-[#080808] w-6 h-6 flex items-center justify-center rounded-full font-bold" : "text-[#F5F5F3]/50"}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div 
                          key={e.id} 
                          onClick={(ev) => { ev.stopPropagation(); setViewingEvent(e); }}
                          className="flex items-center gap-1.5 px-2 py-1 bg-[#121212] hover:bg-[#1C1C1C] border border-[#1E1E1E] hover:border-[#C9A227]/50 transition-all rounded-[2px] group/pill cursor-pointer"
                          title={`${e.title} (${e.event_time || 'Sin hora'}) - Clic para ver detalles`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${typeDots[e.event_type] || "bg-[#F5F5F3]/30"}`} />
                          <span className="text-[10px] text-[#F5F5F3]/70 group-hover/pill:text-[#C9A227] truncate">
                            {e.event_time ? `${e.event_time} ` : ''}{e.title}
                          </span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[9px] text-[#C9A227] hover:underline font-medium pl-1">
                          +{dayEvents.length - 3} más
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDay && (
            <div className="mt-6 bg-[#080808] border border-[#1A1A1A] p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[#F5F5F3]/80 text-sm font-heading capitalize">{formatDate(selectedDay.date)}</h4>
                <button onClick={() => setSelectedDay(null)} className="text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase hover:text-[#F5F5F3]">Cerrar</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
                {selectedDay.events.map(renderEventCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event Details Pop-up Modal */}
      <Modal open={!!viewingEvent} onClose={() => setViewingEvent(null)} title="Detalles del Evento">
        {viewingEvent && (
          <div className="space-y-4 text-left">
            <div className="pb-3 border-b border-[#1A1A1A]">
              <span className={`text-[10px] tracking-wider uppercase px-2.5 py-1 inline-block mb-2 font-medium ${typeColors[viewingEvent.event_type] || ""}`}>
                {typeLabels[viewingEvent.event_type] || viewingEvent.event_type}
              </span>
              <h3 className="text-[#F5F5F3] text-lg font-heading">{viewingEvent.title}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] flex items-center gap-2.5">
                <CalIcon size={16} className="text-[#C9A227] flex-shrink-0" />
                <div>
                  <p className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider">Fecha</p>
                  <p className="text-[#F5F5F3] capitalize">{formatDate(viewingEvent.event_date)}</p>
                </div>
              </div>
              <div className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] flex items-center gap-2.5">
                <Clock size={16} className="text-[#C9A227] flex-shrink-0" />
                <div>
                  <p className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider">Hora</p>
                  <p className="text-[#F5F5F3]">{viewingEvent.event_time || "Sin hora específica"}</p>
                </div>
              </div>
            </div>

            {viewingEvent.case_id && (
              <div className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] flex items-start gap-2.5">
                <Briefcase size={16} className="text-[#C9A227] flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider">Caso Vinculado</p>
                  <p className="text-[#F5F5F3] text-sm font-medium">
                    {cases.find(c => c.id === viewingEvent.case_id)?.title || "Caso Vinculado"}
                    <span className="text-[#C9A227] ml-2 text-xs">
                      ({cases.find(c => c.id === viewingEvent.case_id)?.case_number})
                    </span>
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] flex items-start gap-2.5">
              <Users size={16} className="text-[#C9A227] flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider">Abogado(s) Asignado(s)</p>
                <p className="text-[#F5F5F3] text-sm">{lawyers(viewingEvent.assigned_lawyers)}</p>
              </div>
            </div>

            {viewingEvent.description && (
              <div className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] flex items-start gap-2.5">
                <FileText size={16} className="text-[#C9A227] flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[#F5F5F3]/30 text-[10px] uppercase tracking-wider mb-1">Descripción / Notas</p>
                  <p className="text-[#F5F5F3]/80 text-xs whitespace-pre-line leading-relaxed">{viewingEvent.description}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => {
                  const ev = viewingEvent;
                  setViewingEvent(null);
                  openEdit(ev);
                }}
                className="flex-1 bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-4 py-2.5 hover:bg-[#A8841D] transition-colors flex items-center justify-center gap-1.5 font-medium"
              >
                <Pencil size={13} /> Editar Evento
              </button>
              <button
                type="button"
                onClick={() => {
                  const ev = viewingEvent;
                  setViewingEvent(null);
                  remove(ev);
                }}
                className="px-4 py-2.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Event Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar Evento" : "Nuevo Evento"}>
        <div className="space-y-4">
          <div><label className={labelCls}>Título</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nombre del evento" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Tipo</label><select className={inputCls} value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{typeLabels[t] || t}</option>)}</select></div>
            <div><label className={labelCls}>Hora</label><input type="time" className={inputCls} value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} /></div>
          </div>
          <div><label className={labelCls}>Fecha</label><input type="date" className={inputCls} value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
          <div>
            <label className={labelCls}>Caso Vinculado</label>
            <select className={inputCls} value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })}>
              <option value="">Sin caso vinculado</option>
              {visibleCases.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              Abogados asignados {activeEventAreaId && <span className="text-[#C9A227] font-normal normal-case">({areas.find(a => a.id === activeEventAreaId)?.name})</span>}
            </label>
            <LawyerSelect members={eligibleLawyersForEvent} selected={form.assigned_lawyers} onChange={(v) => setForm({ ...form, assigned_lawyers: v })} />
          </div>
          <div><label className={labelCls}>Descripción</label><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" /></div>
          <button onClick={submit} disabled={!form.title || !form.event_date || saving} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors">{saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Crear Evento"}</button>
        </div>
      </Modal>
    </div>
  );
}