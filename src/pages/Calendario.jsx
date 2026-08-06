import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Calendar as CalIcon, MapPin, Clock, ChevronLeft, ChevronRight, LayoutGrid, List, Pencil, Trash2 } from "lucide-react";
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

function formatDate(d) { return new Date(d).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
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
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendario");
  const [filterType, setFilterType] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [cursor, setCursor] = useState(new Date());
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [eRes, mRes, cRes] = await Promise.all([
        supabase.from('calendar_events').select('*').order('event_date', { ascending: true }),
        supabase.from('team_members').select('*'),
        supabase.from('cases').select('*')
      ]);
      if (eRes.data) setEvents(eRes.data);
      if (mRes.data) setMembers(mRes.data);
      if (cRes.data) setCases(cRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filter cases and events by Area:
  // If not admin, only show cases belonging to user's assigned area.
  // And only show events associated with those visible cases (or events with no case).
  const visibleCases = cases.filter(c => isAdmin || c.area_id === profile?.area_id);
  const visibleEvents = events.filter(e => !e.case_id || visibleCases.some(c => c.id === e.case_id));

  const filtered = filterType === "all" ? visibleEvents : visibleEvents.filter((e) => e.event_type === filterType);
  const allSorted = [...filtered].sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  const grouped = allSorted.reduce((acc, e) => { const day = formatDate(e.event_date); if (!acc[day]) acc[day] = []; acc[day].push(e); return acc; }, {});

  const monthMatrix = getMonthMatrix(cursor.getFullYear(), cursor.getMonth());
  const eventsForDay = (date) => filtered.filter((e) => isSameDay(e.event_date, date));

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

      if (editingId) { 
        await supabase.from('calendar_events').update(payload).eq('id', editingId); 
      } else { 
        await supabase.from('calendar_events').insert([payload]); 
      }
      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const remove = async (e) => {
    if (!confirm(`¿Eliminar el evento "${e.title}"?`)) return;
    try { 
      await supabase.from('calendar_events').delete().eq('id', e.id); 
      if (selectedDay) setSelectedDay(null); 
      load(); 
    } catch (err) { console.error(err); }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  const renderEventCard = (e) => (
    <div key={e.id} className="bg-[#0F0F0F] border border-[#1A1A1A] p-4 group">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[9px] tracking-wider uppercase px-2 py-1 ${typeColors[e.event_type] || ""}`}>{typeLabels[e.event_type] || e.event_type}</span>
        <div className="flex items-center gap-2">
          {e.event_time && <span className="text-[#F5F5F3]/30 text-[11px] flex items-center gap-1"><Clock size={11} />{e.event_time}</span>}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => openEdit(e)} className="p-0.5 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"><Pencil size={12} /></button>
            <button onClick={() => remove(e)} className="p-0.5 text-[#F5F5F3]/30 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
      <p className="text-[#F5F5F3] text-sm mb-2">{e.title}</p>
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
                  <div key={i} onClick={() => setSelectedDay(dayEvents.length > 0 ? { date, events: dayEvents } : null)} className={`min-h-[100px] md:min-h-[120px] border-r border-b border-[#1A1A1A] p-2 cursor-pointer hover:bg-[#0F0F0F] transition-colors ${!isCurrentMonth ? "opacity-30" : ""}`}>
                    <div className={`text-xs mb-1 ${isToday ? "bg-[#C9A227] text-[#080808] w-6 h-6 flex items-center justify-center rounded-full" : "text-[#F5F5F3]/50"}`}>{date.getDate()}</div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div key={e.id} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${typeDots[e.event_type] || "bg-[#F5F5F3]/30"}`} />
                          <span className="text-[10px] text-[#F5F5F3]/60 truncate">{e.event_time ? `${e.event_time} ` : ''}{e.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && <p className="text-[9px] text-[#C9A227]">+{dayEvents.length - 3} más</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDay && (
            <div className="mt-6 bg-[#080808] border border-[#1A1A1A] p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[#F5F5F3]/80 text-sm font-heading">{formatDate(selectedDay.date)}</h4>
                <button onClick={() => setSelectedDay(null)} className="text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase hover:text-[#F5F5F3]">Cerrar</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
                {selectedDay.events.map(renderEventCard)}
              </div>
            </div>
          )}
        </div>
      )}

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
          <div><label className={labelCls}>Abogados asignados</label><LawyerSelect members={members} selected={form.assigned_lawyers} onChange={(v) => setForm({ ...form, assigned_lawyers: v })} /></div>
          <div><label className={labelCls}>Descripción</label><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" /></div>
          <button onClick={submit} disabled={!form.title || !form.event_date || saving} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors">{saving ? "Guardando…" : editingId ? "Guardar Cambios" : "Crear Evento"}</button>
        </div>
      </Modal>
    </div>
  );
}