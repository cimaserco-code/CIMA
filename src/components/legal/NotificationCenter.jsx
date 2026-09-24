import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Briefcase, CheckSquare, FileText, Calendar, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { fetchUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, createNotification } from "@/lib/notificationService";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";

const TYPE_ICONS = {
  caso: { icon: Briefcase, color: "text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/20" },
  tarea: { icon: CheckSquare, color: "text-sky-400 bg-sky-400/10 border-sky-400/20" },
  documento: { icon: FileText, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  evento: { icon: Calendar, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  general: { icon: Bell, color: "text-[#F5F5F3]/60 bg-[#F5F5F3]/5 border-[#1A1A1A]" }
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const knownIdsRef = useRef(null);

  const loadNotifications = async () => {
    if (!user && !profile) return;
    try {
      const data = await fetchUserNotifications({
        userId: user?.id,
        userEmail: user?.email,
        userName: profile?.full_name
      });

      const list = data || [];

      // If already initialized, show pop-up toast for any brand new unread notifications
      if (knownIdsRef.current !== null) {
        for (const n of list) {
          if (!n.read && !knownIdsRef.current.has(n.id)) {
            toast({
              title: n.title || "Nueva Notificación",
              description: n.message || ""
            });
            knownIdsRef.current.add(n.id);
          }
        }
      } else {
        // Initial load: populate known IDs without spamming pop-ups
        knownIdsRef.current = new Set(list.map(n => n.id));
      }

      setNotifications(list);
    } catch (err) {
      console.warn("Error cargando notificaciones:", err);
    }
  };

  const checkEventReminders = async () => {
    if (!user && !profile) return;
    try {
      // Formato YYYY-MM-DD local
      const now = new Date();
      const pad = (num) => String(num).padStart(2, "0");
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      const { data: todayEvents } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", todayStr)
        .lte("event_date", todayStr);

      if (!todayEvents || todayEvents.length === 0) return;

      const userNameLower = (profile?.full_name || "").toLowerCase().trim();
      const userEmailLower = (user?.email || "").toLowerCase().trim();

      for (const ev of todayEvents) {
        const assigned = Array.isArray(ev.assigned_lawyers)
          ? ev.assigned_lawyers
          : (ev.assigned_lawyers ? [ev.assigned_lawyers] : []);

        const isAssignedToMe = assigned.some(name => {
          const lName = String(name).toLowerCase().trim();
          return (
            (userNameLower && (lName.includes(userNameLower) || userNameLower.includes(lName))) ||
            (userEmailLower && lName.includes(userEmailLower))
          );
        });

        if (!isAssignedToMe) continue;

        let evTime = ev.event_time || "09:00";
        const timeParts = evTime.split(":");
        const hours = parseInt(timeParts[0], 10) || 0;
        const minutes = parseInt(timeParts[1], 10) || 0;

        const dateParts = ev.event_date.split("-");
        const evDate = new Date(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1,
          parseInt(dateParts[2], 10),
          hours,
          minutes,
          0
        );

        const diffMs = evDate.getTime() - now.getTime();
        const diffMinutes = Math.round(diffMs / 60000);

        // Si el evento comienza dentro de 1 a 65 minutos (alrededor de 1 hora antes)
        if (diffMinutes >= 1 && diffMinutes <= 65) {
          const cacheKey = `cima_notif_1h_${ev.id}_${user.id}`;
          if (!localStorage.getItem(cacheKey)) {
            localStorage.setItem(cacheKey, new Date().toISOString());

            const title = `Recordatorio: ${ev.title} en 1 hora`;
            const message = `Tu evento "${ev.title}" está programado para hoy a las ${ev.event_time || "hora establecida"} (en aprox. ${diffMinutes} min).`;

            await createNotification({
              recipientUserId: user.id,
              recipientName: profile?.full_name,
              recipientEmail: user.email,
              type: "evento",
              title,
              message,
              link: "/calendario",
              metadata: { event_id: ev.id, reminder_1h: true }
            });

            toast({
              title,
              description: message
            });

            loadNotifications();
          }
        }
      }
    } catch (err) {
      console.warn("Error verificando recordatorios de eventos:", err);
    }
  };

  useEffect(() => {
    loadNotifications();
    checkEventReminders();
    const notifInterval = setInterval(loadNotifications, 20000);
    const reminderInterval = setInterval(checkEventReminders, 60000);
    return () => {
      clearInterval(notifInterval);
      clearInterval(reminderInterval);
    };
  }, [user?.id, user?.email, profile?.full_name]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id, notif._is_fallback);
      setNotifications(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    setOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    setLoading(true);
    await markAllNotificationsAsRead(notifications);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setLoading(false);
  };

  const handleDeleteNotification = async (notif) => {
    const deleted = await deleteNotification(notif.id, notif._is_fallback);
    if (deleted) {
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
      knownIdsRef.current?.delete(notif.id);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-[#F5F5F3]/60 hover:text-[#C9A227] hover:bg-[#141414] rounded transition-colors"
        title="Notificaciones"
        aria-label="Abrir notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[17px] h-[17px] bg-[#C9A227] text-[#080808] text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0A0A0A] border border-[#1E1E1E] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A] bg-[#0E0E0E]">
            <div className="flex items-center gap-2">
              <span className="font-heading text-xs tracking-wider uppercase text-[#F5F5F3] font-semibold">
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/20 px-1.5 py-0.5 rounded">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={loading}
                className="text-[11px] text-[#C9A227] hover:underline flex items-center gap-1 transition-colors"
              >
                <CheckCheck size={13} />
                <span>Marcar leídas</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#141414]">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <Bell size={24} className="text-[#F5F5F3]/10 mx-auto mb-2" />
                <p className="text-xs text-[#F5F5F3]/40">No tienes notificaciones por el momento</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const style = TYPE_ICONS[notif.type] || TYPE_ICONS.general;
                const IconComponent = style.icon;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-[#121212] transition-colors cursor-pointer group relative ${
                      !notif.read ? "bg-[#C9A227]/[0.03]" : ""
                    }`}
                  >
                    {/* Unread Indicator Bar */}
                    {!notif.read && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#C9A227]" />
                    )}

                    {/* Type Icon */}
                    <div
                      className={`p-2 rounded border flex-shrink-0 mt-0.5 ${style.color}`}
                    >
                      <IconComponent size={14} />
                    </div>

                    {/* Text Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={`text-xs truncate ${
                            !notif.read
                              ? "text-[#F5F5F3] font-medium group-hover:text-[#C9A227]"
                              : "text-[#F5F5F3]/70 group-hover:text-[#F5F5F3]"
                          } transition-colors`}
                        >
                          {notif.title}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-[#F5F5F3]/30">
                            {formatRelativeTime(notif.created_at)}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteNotification(notif);
                            }}
                            className="p-1 text-[#F5F5F3]/25 hover:text-red-400 transition-colors"
                            title="Eliminar notificación"
                            aria-label={`Eliminar notificación ${notif.title || ""}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#F5F5F3]/50 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-[#1A1A1A] bg-[#0A0A0A] text-center">
            <span className="text-[10px] text-[#F5F5F3]/30">
              Notificaciones de casos, tareas, documentos y eventos
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
