import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Briefcase, CheckSquare, FileText, Calendar, ExternalLink, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { fetchUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/notificationService";

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

  const loadNotifications = async () => {
    if (!user && !profile) return;
    try {
      const data = await fetchUserNotifications({
        userId: user?.id,
        userEmail: user?.email,
        userName: profile?.full_name
      });
      setNotifications(data || []);
    } catch (err) {
      console.warn("Error cargando notificaciones:", err);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 25000);
    return () => clearInterval(interval);
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
                        <span className="text-[10px] text-[#F5F5F3]/30 flex-shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
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
