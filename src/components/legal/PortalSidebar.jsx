import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Briefcase, FileText, CheckSquare, Calendar, Users, Shield, X, LogOut, DollarSign, Contact, Eye } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { label: "Inicio", icon: LayoutDashboard, path: "/" },
  { label: "Casos", icon: Briefcase, path: "/casos" },
  { label: "Documentos", icon: FileText, path: "/documentos" },
  { label: "Tareas y Términos", icon: CheckSquare, path: "/tareas" },
  { label: "Calendario", icon: Calendar, path: "/calendario" },
  { label: "Equipo", icon: Users, path: "/equipo" },
  { label: "Honorarios", icon: DollarSign, path: "/honorarios" },
  { label: "Clientes", icon: Contact, path: "/clientes" },
];

const adminItem = { label: "Administración", icon: Shield, path: "/administracion" };

export default function PortalSidebar({ open, onClose }) {
  const { user, profile, permissions, logout } = useAuth();

  const isClientRole = profile?.role === 'Cliente';
  
  let items = [];
  if (isClientRole) {
    items = [{ label: "Mi Portal", icon: Contact, path: "/vista-cliente" }];
  } else {
    items = navItems.filter(item => {
      if (item.label === "Inicio") return true;
      if (item.label === "Casos" && !permissions?.can_view_cases) return false;
      if (item.label === "Documentos" && !permissions?.can_view_documents) return false;
      if (item.label === "Tareas y Términos" && !permissions?.can_view_tasks) return false;
      if (item.label === "Calendario" && !permissions?.can_view_tasks) return false;
      if (item.label === "Equipo") return true;
      if (item.label === "Honorarios" && !permissions?.can_view_fees) return false;
      if (item.label === "Clientes" && !permissions?.can_view_clients) return false;
      return true;
    });
    
    // Add Vista Cliente link for staff/admins to preview client portal
    items.push({ label: "Vista Cliente", icon: Eye, path: "/vista-cliente" });
    
    if (permissions?.can_manage_users) {
      items.push(adminItem);
    }
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#080808] border-r border-[#1A1A1A] flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#1A1A1A]">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <span className="font-heading text-[#F5F5F3] text-sm tracking-[0.3em] uppercase font-semibold">
            CIMA
          </span>
          <button onClick={onClose} className="lg:hidden text-[#F5F5F3]/40 ml-auto"><X size={18} /></button>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 ${isActive ? "bg-[#C9A227]/10 text-[#C9A227] border-l-2 border-[#C9A227]" : "text-[#F5F5F3]/50 hover:text-[#F5F5F3] hover:bg-[#111] border-l-2 border-transparent"}`
              }
            >
              <item.icon size={18} />
              <span className="tracking-wide">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-[#1A1A1A]">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 bg-[#C9A227] flex items-center justify-center text-[#080808] text-xs font-semibold">
              {(profile?.full_name || user?.email || "·").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#F5F5F3] text-xs font-medium truncate">{profile?.full_name || user?.email || "Usuario"}</p>
              <p className="text-[#F5F5F3]/30 text-[10px]">{profile?.role || "Usuario"}</p>
            </div>
            <button onClick={logout} className="text-[#F5F5F3]/30 hover:text-[#F5F5F3]"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}