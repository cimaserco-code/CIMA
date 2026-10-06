import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Calendar as CalIcon, MapPin, Clock, ChevronLeft, ChevronRight, LayoutGrid, List, Pencil, Trash2, Briefcase, Users, FileText, X, Mail, ExternalLink, Download, BellRing } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import LawyerSelect from "@/components/legal/LawyerSelect";
import { useAuth } from "@/lib/AuthContext";
import { cap } from "@/lib/format";
import { logActivity } from "@/lib/activityLogger";
import { createNotification } from "@/lib/notificationService";
import { toast } from "@/components/ui/use-toast";
import { isResourceInUserArea, filterMembersByArea, getAreaCategory, PENAL_AREA_ID, BLP_AREA_ID, isUserGlobalAdmin } from "@/lib/areaPermissions";

export function getEventAreaTag(description) {
  if (!description || typeof description !== "string") return null;
  const match = description.match(/<!--\s*area:(penal|legal|bpl|blp|ambas|todas)\s*-->/i) ||
                description.match(/\[Área:\s*(penal|legal|bpl|blp|ambas|todas)\]/i);
  if (match) {
    const val = match[1].toLowerCase();
    if (val === "legal" || val === "penal") return "penal";
    if (val === "bpl" || val === "blp") return "blp";
    if (val === "ambas" || val === "todas") return "ambas";
  }
  return null;
}

export function getEventReminder(description) {
  if (!description || typeof description !== "string") return null;
  const match = description.match(/<!--\s*reminder:([^|]+)\|([^\s>]+)\s*-->/i);
  if (match) {
    return {
      timing: match[1],
      email: match[2]
    };
  }
  return null;
}

export function cleanDescription(description) {
  if (!description || typeof description !== "string") return "";
  return description
    .replace(/<!--\s*area:[^>]+-->\s*/gi, "")
    .replace(/<!--\s*reminder:[^>]+-->\s*/gi, "")
    .replace(/\[Área:\s*(penal|legal|bpl|blp|ambas|todas)\]\s*/gi, "")
    .trim();
}

export function injectAreaTag(description, area) {
  const clean = cleanDescription(description);
  if (!area) return clean;
  return `<!-- area:${area} -->\n${clean}`.trim();
}

export function injectEventMetadata(description, area, reminder) {
  let clean = cleanDescription(description);
  if (reminder && reminder.enabled && reminder.email) {
    clean = `<!-- reminder:${reminder.timing || '1h'}|${reminder.email.trim()} -->\n${clean}`.trim();
  }
  if (area) {
    clean = `<!-- area:${area} -->\n${clean}`.trim();
  }
  return clean;
}

export function getGoogleCalendarUrl(event, cases) {
  const caseObj = cases?.find(c => c.id === event.case_id);
  const title = encodeURIComponent(event.title || "Evento Legal CIMA");
  const dateStr = (event.event_date || "").replace(/-/g, "");
  let startISO = dateStr;
  let endISO = dateStr;

  if (event.event_time) {
    const parts = String(event.event_time).split(":");
    const h = (parts[0] || "09").padStart(2, "0");
    const m = (parts[1] || "00").padStart(2, "0");
    startISO = `${dateStr}T${h}${m}00`;
    const endH = String((parseInt(h, 10) + 1) % 24).padStart(2, "0");
    endISO = `${dateStr}T${endH}${m}00`;
  }

  const lawyersStr = Array.isArray(event.assigned_lawyers) ? event.assigned_lawyers.join(", ") : (event.assigned_lawyers || "—");
  const cleanDesc = cleanDescription(event.description || "");
  const details = encodeURIComponent(
    `${cleanDesc}\n\nTipo: ${event.event_type || 'Evento'}\nCaso: ${caseObj ? `${caseObj.title} (${caseObj.case_number})` : 'Sin caso'}\nAbogados: ${lawyersStr}\nDespacho CIMA`
  );
  const location = encodeURIComponent("Despacho CIMA / Juzgados");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startISO}/${endISO}&details=${details}&location=${location}`;
}

export function downloadEventIcs(event, cases) {
  const caseObj = cases?.find(c => c.id === event.case_id);
  const dateStr = (event.event_date || "").replace(/-/g, "");
  let startISO = dateStr;
  let endISO = dateStr;

  if (event.event_time) {
    const parts = String(event.event_time).split(":");
    const h = (parts[0] || "09").padStart(2, "0");
    const m = (parts[1] || "00").padStart(2, "0");
    startISO = `${dateStr}T${h}${m}00`;
    const endH = String((parseInt(h, 10) + 1) % 24).padStart(2, "0");
    endISO = `${dateStr}T${endH}${m}00`;
  }

  const lawyersStr = Array.isArray(event.assigned_lawyers) ? event.assigned_lawyers.join(", ") : (event.assigned_lawyers || "—");
  const cleanDesc = cleanDescription(event.description || "").replace(/\n/g, "\\n");
  const caseInfo = caseObj ? `${caseObj.title} (${caseObj.case_number})` : "Sin caso";

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CIMA//Calendario Juridico//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `SUMMARY:${(event.title || "Evento CIMA").replace(/[,;]/g, " ")}`,
    `DESCRIPTION:${cleanDesc} | Caso: ${caseInfo} | Abogados: ${lawyersStr}`,
    `LOCATION:Despacho CIMA / Juzgados`,
    `DTSTART:${startISO}`,
    `DTEND:${endISO}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(event.title || "evento_cima").toLowerCase().replace(/[^a-z0-9]/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAllEventsIcs(eventsList, casesList) {
  if (!eventsList || eventsList.length === 0) {
    alert("No hay eventos disponibles para exportar.");
    return;
  }
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CIMA//Calendario Juridico//ES",
    "CALSCALE:GREGORIAN"
  ];

  eventsList.forEach(event => {
    const caseObj = casesList?.find(c => c.id === event.case_id);
    const dateStr = (event.event_date || "").replace(/-/g, "");
    if (!dateStr) return;
    let startISO = dateStr;
    let endISO = dateStr;

    if (event.event_time) {
      const parts = String(event.event_time).split(":");
      const h = (parts[0] || "09").padStart(2, "0");
      const m = (parts[1] || "00").padStart(2, "0");
      startISO = `${dateStr}T${h}${m}00`;
      const endH = String((parseInt(h, 10) + 1) % 24).padStart(2, "0");
      endISO = `${dateStr}T${endH}${m}00`;
    }

    const lawyersStr = Array.isArray(event.assigned_lawyers) ? event.assigned_lawyers.join(", ") : (event.assigned_lawyers || "—");
    const cleanDesc = cleanDescription(event.description || "").replace(/\n/g, "\\n");
    const caseInfo = caseObj ? `${caseObj.title} (${caseObj.case_number})` : "Sin caso";

    icsLines.push(
      "BEGIN:VEVENT",
      `SUMMARY:${(event.title || "Evento CIMA").replace(/[,;]/g, " ")}`,
      `DESCRIPTION:${cleanDesc} | Caso: ${caseInfo} | Abogados: ${lawyersStr}`,
      `LOCATION:Despacho CIMA / Juzgados`,
      `DTSTART:${startISO}`,
      `DTEND:${endISO}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  });

  icsLines.push("END:VCALENDAR");

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cima_agenda_completa.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
const areaStyles = {
  penal: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  blp: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  ambas: "border-purple-400/30 bg-purple-400/10 text-purple-300",
  unknown: "border-[#F5F5F3]/15 bg-[#F5F5F3]/5 text-[#F5F5F3]/40"
};

const EMPTY = { 
  title: "", 
  event_type: "audiencia", 
  event_date: "", 
  event_time: "", 
  case_id: "", 
  assigned_lawyers: [], 
  description: "", 
  area: "legal",
  reminder_enabled: true,
  reminder_timing: "1d",
  reminder_email: ""
};

export default function Calendario() {
  const { user, profile, permissions } = useAuth();
  const isAdmin = isUserGlobalAdmin(profile, permissions);
  const role = (profile?.role || "").trim().toLowerCase();
  const showAreaLabels = role === "admin" || role === "direccion general";

  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [cases, setCases] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendario");
  const [filterType, setFilterType] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [gCalModalOpen, setGCalModalOpen] = useState(false);
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

  // Filter cases and events strictly by Area:
  const visibleCases = cases.filter(c => isResourceInUserArea(c, profile, { cases, members }, permissions));
  const visibleEvents = events.filter(e => isResourceInUserArea(e, profile, { cases, members }, permissions));
  const getEventArea = (event) => {
    const tagged = getEventAreaTag(event.description);
    if (tagged) return tagged;
    const areaId = event.area_id || cases.find(c => c.id === event.case_id)?.area_id;
    return getAreaCategory(areaId);
  };
  const renderAreaBadge = (event, compact = false) => {
    if (!showAreaLabels) return null;
    const area = getEventArea(event);
    const label = area === "penal" ? "LEGAL" : area === "blp" ? "BLP" : area === "ambas" ? "AMBAS" : "SIN ÁREA";
    return (
      <span className={`inline-flex items-center border font-medium tracking-wider uppercase ${areaStyles[area || "unknown"]} ${compact ? "px-1 py-0.5 text-[7px]" : "px-2 py-1 text-[9px]"}`}>
        {label}
      </span>
    );
  };

  const filtered = filterType === "all" ? visibleEvents : visibleEvents.filter((e) => e.event_type === filterType);
  const allSorted = [...filtered].sort(compareEvents);
  const grouped = allSorted.reduce((acc, e) => { const day = formatDate(e.event_date); if (!acc[day]) acc[day] = []; acc[day].push(e); return acc; }, {});

  const monthMatrix = getMonthMatrix(cursor.getFullYear(), cursor.getMonth());
  const eventsForDay = (date) => filtered.filter((e) => isSameDay(e.event_date, date)).sort(compareEvents);

  // Lawyer area filtering when assigning in modal:
  const selectedCaseForEvent = cases.find(c => c.id === form.case_id);
  const activeEventAreaId = selectedCaseForEvent?.area_id || (!isAdmin ? profile?.area_id : null);
  const eligibleLawyersForEvent = React.useMemo(() => {
    if (!isAdmin) {
      return filterMembersByArea(members, profile, permissions);
    }
    if (form.area === "ambas") {
      return members;
    }
    if (form.area === "blp") {
      return filterMembersByArea(members, { area_id: BLP_AREA_ID }, { can_view_all_cases: false });
    }
    if (form.area === "penal" || form.area === "legal") {
      return filterMembersByArea(members, { area_id: PENAL_AREA_ID }, { can_view_all_cases: false });
    }
    if (selectedCaseForEvent) {
      return filterMembersByArea(members, { area_id: selectedCaseForEvent.area_id }, { can_view_all_cases: false });
    }
    return members;
  }, [members, isAdmin, form.area, selectedCaseForEvent, profile, permissions]);

  const openNew = () => { 
    setEditingId(null); 
    const defaultArea = profile?.area_id ? getAreaCategory(profile.area_id) || "legal" : "legal";
    setForm({ 
      ...EMPTY, 
      area: defaultArea,
      reminder_enabled: true,
      reminder_timing: "1d",
      reminder_email: user?.email || ""
    }); 
    setModalOpen(true); 
  };
  const openEdit = (e) => {
    setEditingId(e.id);
    const taggedArea = getEventAreaTag(e.description);
    const caseArea = e.case_id ? getAreaCategory(cases.find(c => c.id === e.case_id)?.area_id) : null;
    const currentArea = taggedArea || caseArea || (profile?.area_id ? getAreaCategory(profile.area_id) || "legal" : "legal");
    const reminderInfo = getEventReminder(e.description);

    setForm({ 
      title: e.title || "", 
      event_type: e.event_type || "audiencia", 
      event_date: e.event_date || "", 
      event_time: e.event_time || "", 
      case_id: e.case_id || "", 
      assigned_lawyers: toArray(e.assigned_lawyers), 
      description: cleanDescription(e.description),
      area: currentArea,
      reminder_enabled: true,
      reminder_timing: reminderInfo?.timing || "1d",
      reminder_email: reminderInfo?.email || user?.email || ""
    });
    setModalOpen(true);
  };

  const submit = async (syncWithGoogle = false) => {
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
      const targetEmail = (form.reminder_email || user?.email || "").trim();
      const finalDesc = injectEventMetadata(form.description, form.area, {
        enabled: true,
        timing: form.reminder_timing || "1d",
        email: targetEmail
      });
      const payload = {
        title: form.title,
        event_type: form.event_type,
        event_date: form.event_date,
        event_time: form.event_time || null,
        case_id: form.case_id || null,
        assigned_lawyers: form.assigned_lawyers,
        description: finalDesc
      };

      let res;
      if (editingId) { 
        res = await supabase.from('calendar_events').update(payload).eq('id', editingId); 
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "EDITAR",
            module: "Calendario",
            description: `Actualizó el evento "${form.title}" (${typeLabels[form.event_type] || form.event_type}) para el ${form.event_date}`,
            metadata: { event_id: editingId, event_date: form.event_date }
          });
        }
      } else { 
        res = await supabase.from('calendar_events').insert([payload]); 
        if (!res.error) {
          logActivity({
            userId: user?.id,
            userName: profile?.full_name || user?.email || "Usuario",
            userEmail: user?.email,
            action: "CREAR",
            module: "Calendario",
            description: `Agendó el evento "${form.title}" (${typeLabels[form.event_type] || form.event_type}) para el ${form.event_date}`,
            metadata: { event_date: form.event_date, event_time: form.event_time }
          });
        }
      }
      if (res.error) throw res.error;

      // Si el usuario seleccionó sincronizar con Google Calendar
      if (syncWithGoogle) {
        const gcalUrl = getGoogleCalendarUrl(payload, cases);
        window.open(gcalUrl, "_blank", "noopener,noreferrer");
      }

      // Disparar notificaciones a los abogados asignados
      const assigned = Array.isArray(form.assigned_lawyers) ? form.assigned_lawyers : [form.assigned_lawyers];
      const userNameLower = (profile?.full_name || "").toLowerCase().trim();
      const userEmailLower = (user?.email || "").toLowerCase().trim();

      for (const lawyerName of assigned) {
        if (lawyerName) {
          const notifTitle = editingId ? "Evento actualizado" : "Nuevo evento agendado";
          const notifMsg = `Te han asignado el evento "${form.title}" para el ${formatDate(form.event_date)}${form.event_time ? ` a las ${form.event_time}` : ""}`;
          
          createNotification({
            recipientName: lawyerName,
            type: "evento",
            title: notifTitle,
            message: notifMsg,
            link: "/calendario",
            metadata: { event_title: form.title, event_date: form.event_date }
          });

          // Disparar popup inmediato si el usuario autenticado es uno de los asignados
          const lLower = lawyerName.toLowerCase().trim();
          if ((userNameLower && lLower.includes(userNameLower)) || (userEmailLower && lLower.includes(userEmailLower))) {
            toast({
              title: notifTitle,
              description: notifMsg
            });
          }
        }
      }

      toast({
        title: editingId ? "Evento actualizado" : "Evento creado",
        description: `Guardado en CIMA.${targetEmail ? ` Aviso automático programado a ${targetEmail}.` : ""}${syncWithGoogle ? " Abriendo Google Calendar..." : ""}`
      });

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
      logActivity({
        userId: user?.id,
        userName: profile?.full_name || user?.email || "Usuario",
        userEmail: user?.email,
        action: "ELIMINAR",
        module: "Calendario",
        description: `Eliminó el evento "${e.title}" del ${e.event_date}`,
        metadata: { event_id: e.id, event_date: e.event_date }
      });
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

  const renderEventCard = (e) => {
    const rem = getEventReminder(e.description);
    return (
      <div 
        key={e.id} 
        onClick={() => setViewingEvent(e)}
        className="bg-[#0F0F0F] border border-[#1A1A1A] p-4 group cursor-pointer hover:border-[#C9A227]/50 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] tracking-wider uppercase px-2 py-0.5 font-medium ${typeColors[e.event_type] || ""}`}>
              {typeLabels[e.event_type] || e.event_type}
            </span>
            {renderAreaBadge(e)}
            {rem && (
              <span className="inline-flex items-center gap-1 text-[8px] text-[#C9A227] bg-[#C9A227]/10 px-1.5 py-0.5 border border-[#C9A227]/20 rounded-sm" title={`Aviso a ${rem.email}`}>
                <BellRing size={8} /> {rem.timing === '1d' ? '1d antes' : rem.timing + ' antes'}
              </span>
            )}
          </div>
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

        {/* Botón de vinculación directa con Google Calendar y descarga .ics */}
        <div className="mt-3 pt-2.5 border-t border-[#181818] flex items-center justify-between gap-2">
          <a
            href={getGoogleCalendarUrl(e, cases)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(ev) => ev.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[11px] text-[#C9A227] hover:text-[#e0b838] transition-colors font-medium hover:underline bg-[#C9A227]/10 px-2.5 py-1 rounded-sm border border-[#C9A227]/25"
            title="Sincronizar y añadir este evento directamente a tu Google Calendar"
          >
            <ExternalLink size={12} />
            <span>Google Calendar</span>
          </a>
          <button
            type="button"
            onClick={(ev) => { ev.stopPropagation(); downloadEventIcs(e, cases); }}
            className="text-[10px] text-[#F5F5F3]/40 hover:text-[#F5F5F3] px-2 py-1 bg-[#141414] hover:bg-[#1E1E1E] border border-[#1E1E1E] rounded-sm transition-colors"
            title="Descargar archivo de calendario .ics para Outlook/iPhone"
          >
            Descargar .ics
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Calendario" subtitle={`${filtered.length} eventos`} action={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#080808] border border-[#1A1A1A]">
            <button onClick={() => setView("calendario")} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] tracking-wider uppercase transition-colors ${view === "calendario" ? "bg-[#C9A227] text-[#080808]" : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"}`}><LayoutGrid size={13} /> Calendario</button>
            <button onClick={() => setView("lista")} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] tracking-wider uppercase transition-colors ${view === "lista" ? "bg-[#C9A227] text-[#080808]" : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"}`}><List size={13} /> Lista</button>
          </div>

          <button 
            onClick={() => setGCalModalOpen(true)} 
            className="border border-[#C9A227]/40 bg-[#C9A227]/10 hover:bg-[#C9A227]/20 text-[#C9A227] text-xs tracking-wider uppercase px-3.5 py-2.5 flex items-center gap-2 transition-colors font-medium"
            title="Vinculación y sincronización con Google Calendar"
          >
            <ExternalLink size={14} />
            <span>Google Calendar</span>
          </button>

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

      {showAreaLabels && (
        <div className="flex items-center gap-4 mb-5 text-[9px] tracking-wider uppercase" aria-label="Leyenda de áreas">
          <span className="text-[#F5F5F3]/35">Área del evento:</span>
          <span className="inline-flex items-center gap-1.5 text-rose-300"><span className="w-2 h-2 bg-rose-400" />Legal / Penal</span>
          <span className="inline-flex items-center gap-1.5 text-cyan-300"><span className="w-2 h-2 bg-cyan-400" />BLP</span>
          <span className="inline-flex items-center gap-1.5 text-purple-300"><span className="w-2 h-2 bg-purple-400" />Ambas</span>
        </div>
      )}

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
                          className={`flex items-center gap-1.5 px-2 py-1 bg-[#121212] hover:bg-[#1C1C1C] border ${showAreaLabels && getEventArea(e) ? areaStyles[getEventArea(e)] : "border-[#1E1E1E] hover:border-[#C9A227]/50"} transition-all rounded-[2px] group/pill cursor-pointer`}
                          title={`${e.title} (${e.event_time || 'Sin hora'}) - Clic para ver detalles`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${typeDots[e.event_type] || "bg-[#F5F5F3]/30"}`} />
                          {renderAreaBadge(e, true)}
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
              {renderAreaBadge(viewingEvent)}
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
                  <p className="text-[#F5F5F3]/80 text-xs whitespace-pre-line leading-relaxed">{cleanDescription(viewingEvent.description)}</p>
                </div>
              </div>
            )}

            {(() => {
              const rem = getEventReminder(viewingEvent.description);
              if (!rem) return null;
              return (
                <div className="p-3 bg-[#0F0F0F] border border-[#C9A227]/30 flex items-center gap-2.5">
                  <BellRing size={16} className="text-[#C9A227] flex-shrink-0" />
                  <div>
                    <p className="text-[#F5F5F3]/40 text-[10px] uppercase tracking-wider">Aviso Personal Programado</p>
                    <p className="text-[#F5F5F3] text-xs">
                      Notificación por correo <span className="text-[#C9A227] font-semibold">{rem.timing === '1d' ? '1 día antes' : rem.timing + ' antes'}</span> a <span className="font-mono text-[#F5F5F3]/90">{rem.email}</span>
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Sincronización Externa */}
            <div className="p-3 bg-[#0A0A0A] border border-[#1A1A1A] space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-[#F5F5F3]/40 font-medium">Sincronización de Calendario</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={getGoogleCalendarUrl(viewingEvent, cases)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-[#141414] hover:bg-[#1E1E1E] text-[#F5F5F3] hover:text-[#C9A227] border border-[#1E1E1E] text-xs flex items-center justify-center gap-2 transition-colors font-medium rounded-sm"
                >
                  <ExternalLink size={13} className="text-[#C9A227]" />
                  <span>Añadir a Google Calendar</span>
                </a>
                <button
                  type="button"
                  onClick={() => downloadEventIcs(viewingEvent, cases)}
                  className="px-3 py-2 bg-[#141414] hover:bg-[#1E1E1E] text-[#F5F5F3] hover:text-[#C9A227] border border-[#1E1E1E] text-xs flex items-center justify-center gap-2 transition-colors font-medium rounded-sm"
                >
                  <Download size={13} className="text-[#C9A227]" />
                  <span>Descargar .ics (Outlook/Celular)</span>
                </button>
              </div>
            </div>

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
          {(isAdmin || showAreaLabels) && (
            <div>
              <label className={labelCls}>Área del Evento (Admin)</label>
              <select
                className={inputCls}
                value={form.area || "legal"}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
              >
                <option value="legal">Área Penal / Legal</option>
                <option value="blp">Área Blindaje Legal Preventivo (BLP)</option>
                <option value="ambas">Ambas Áreas (Legal y BLP - Visible para todos)</option>
              </select>
            </div>
          )}
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

          {/* Aviso Personal Automático por Correo Electrónico */}
          <div className="p-3.5 bg-[#0C0C0C] border border-[#C9A227]/30 space-y-3 rounded-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-[#C9A227]" />
                <span className="text-xs text-[#F5F5F3] font-medium">Aviso personal por correo electrónico</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
                ✓ Aviso automático activo
              </span>
            </div>
            <p className="text-[11px] text-[#F5F5F3]/50 leading-relaxed">
              CIMA enviará automáticamente una alerta previa a tu correo para que no se te pase este compromiso.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-[#181818]">
              <div>
                <label className={labelCls}>Correo Personal de Notificación</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.reminder_email}
                  onChange={(e) => setForm({ ...form, reminder_email: e.target.value })}
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
              <div>
                <label className={labelCls}>Anticipación del Aviso</label>
                <select
                  className={inputCls}
                  value={form.reminder_timing || "1d"}
                  onChange={(e) => setForm({ ...form, reminder_timing: e.target.value })}
                >
                  <option value="1d">1 día antes (24 horas) - Predeterminado</option>
                  <option value="12h">12 horas antes</option>
                  <option value="4h">4 horas antes</option>
                  <option value="2h">2 horas antes</option>
                  <option value="1h">1 hora antes</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button 
              type="button"
              onClick={() => submit(true)} 
              disabled={!form.title || !form.event_date || saving} 
              className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors font-semibold flex items-center justify-center gap-2"
              title="Guarda el evento en CIMA y abre de inmediato Google Calendar para agregarlo a tu agenda personal"
            >
              <ExternalLink size={14} />
              {saving ? "Guardando…" : "Guardar y Vincular en Google Calendar"}
            </button>
            <button 
              type="button"
              onClick={() => submit(false)} 
              disabled={!form.title || !form.event_date || saving} 
              className="w-full border border-[#262626] bg-[#121212] hover:bg-[#1A1A1A] text-[#F5F5F3]/80 hover:text-[#F5F5F3] text-xs tracking-wider uppercase px-4 py-2.5 disabled:opacity-30 transition-colors font-medium"
            >
              {saving ? "…" : editingId ? "Guardar solo en CIMA" : "Crear solo en CIMA"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Vinculación y Sincronización con Google Calendar */}
      <Modal open={gCalModalOpen} onClose={() => setGCalModalOpen(false)} title="Vinculación con Google Calendar">
        <div className="space-y-4 text-left text-xs">
          <div className="p-4 bg-[#0F0F0F] border border-[#C9A227]/30 rounded-sm">
            <div className="flex items-center gap-2 mb-2">
              <CalIcon size={18} className="text-[#C9A227]" />
              <h4 className="text-sm font-semibold text-[#F5F5F3]">Sincronización Directa de CIMA con Google</h4>
            </div>
            <p className="text-[#F5F5F3]/70 leading-relaxed mb-3">
              La integración con Google Calendar está activa en toda la plataforma para evitar duplicidad de captura y mantener tus audiencias y diligencias siempre a la mano:
            </p>
            <ul className="space-y-2 text-[#F5F5F3]/80 list-disc list-inside">
              <li><strong className="text-[#C9A227]">En cada tarjeta de evento:</strong> Haz clic en el botón <span className="text-[#C9A227] font-semibold">"Google Calendar"</span> para añadirlo con un solo clic.</li>
              <li><strong className="text-[#C9A227]">Al agendar un evento:</strong> Usa el botón <span className="text-[#C9A227] font-semibold">"Guardar y Vincular en Google Calendar"</span> para registrarlo en CIMA y enviarlo a tu cuenta de Google.</li>
              <li><strong className="text-[#C9A227]">Aviso personal por correo:</strong> Todos los eventos programan automáticamente una notificación previa a tu buzón (por defecto 1 día antes).</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-[#121212] hover:bg-[#1C1C1C] border border-[#252525] hover:border-[#C9A227]/40 flex items-center justify-between text-[#F5F5F3] font-medium transition-colors rounded-sm"
            >
              <span className="flex items-center gap-2">
                <ExternalLink size={15} className="text-[#C9A227]" />
                Abrir mi Google Calendar
              </span>
              <span className="text-[10px] text-[#F5F5F3]/40">↗</span>
            </a>

            <button
              type="button"
              onClick={() => downloadAllEventsIcs(filtered, cases)}
              className="p-3 bg-[#121212] hover:bg-[#1C1C1C] border border-[#252525] hover:border-[#C9A227]/40 flex items-center justify-between text-[#F5F5F3] font-medium transition-colors text-left rounded-sm"
            >
              <span className="flex items-center gap-2">
                <Download size={15} className="text-[#C9A227]" />
                Descargar todos ({filtered.length}) en .ics
              </span>
              <span className="text-[10px] text-[#F5F5F3]/40">Outlook / Celular</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}