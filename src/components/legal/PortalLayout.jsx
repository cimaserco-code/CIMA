import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, User, Lock, Save, Eye, EyeOff } from "lucide-react";
import PortalSidebar from "./PortalSidebar";
import packageJson from "../../../package.json";
import Modal from "@/components/legal/Modal";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function PortalLayout() {
  const { user, profile, refreshProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Profile Form States
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleOpenProfile = () => {
    setFullName(profile?.full_name || "");
    setPassword("");
    setConfirmPassword("");
    setProfileOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert("Por favor ingresa tu nombre completo.");
      return;
    }

    setSaving(true);
    try {
      // 1. Update Name in profiles
      const { error: nameError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      if (nameError) throw nameError;

      // 2. Optional Password Update
      if (password) {
        if (password !== confirmPassword) {
          alert("Las contraseñas no coinciden.");
          setSaving(false);
          return;
        }
        if (password.length < 6) {
          alert("La contraseña debe tener al menos 6 caracteres.");
          setSaving(false);
          return;
        }
        const { error: passError } = await supabase.auth.updateUser({
          password: password,
        });
        if (passError) throw passError;
        alert("Perfil y contraseña actualizados con éxito.");
      } else {
        alert("Nombre de perfil actualizado con éxito.");
      }

      await refreshProfile();
      setProfileOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la cuenta: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  return (
    <div className="flex h-screen bg-[#080808] relative">
      <PortalSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 overflow-y-auto bg-[#0F0F0F] pb-10">
        <div className="lg:hidden h-14 flex items-center gap-3 px-4 border-b border-[#1A1A1A] bg-[#080808] sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-[#F5F5F3]"><Menu size={22} /></button>
          <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
          <span className="font-heading text-[#F5F5F3] text-sm tracking-[0.3em] uppercase">CIMA</span>
        </div>
        <div className="p-6 md:p-8 lg:p-10">
          <Outlet />
        </div>
      </main>

      {/* Bottom Right corner containing Version and Mi Cuenta Trigger */}
      <div className="fixed bottom-3 right-4 flex items-center gap-4 text-[10px] tracking-[0.2em] uppercase font-mono z-40 select-none">
        <button 
          onClick={handleOpenProfile}
          className="text-[#F5F5F3]/30 hover:text-[#C9A227] pointer-events-auto cursor-pointer font-mono flex items-center gap-1.5 transition-colors border-none bg-transparent"
        >
          <User size={10} /> Mi Cuenta
        </button>
        <span className="text-[#F5F5F3]/10">|</span>
        <span className="text-[#F5F5F3]/10">CIMA v.{packageJson.version}</span>
      </div>

      {/* Edit Profile / Account Modal */}
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="Mi Cuenta">
        <form onSubmit={handleSave} className="space-y-4 text-left">
          <div>
            <label className={labelCls}>Nombre Completo</label>
            <input 
              className={inputCls} 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              placeholder="Juan Pérez" 
              required
            />
          </div>
          <div>
            <label className={labelCls}>Correo Electrónico</label>
            <input 
              readOnly 
              className={`${inputCls} opacity-50 cursor-not-allowed`} 
              value={user?.email || ""} 
            />
            <span className="text-[9px] text-[#F5F5F3]/30 mt-1 block">El correo no puede modificarse por motivos de seguridad.</span>
          </div>

          <hr className="border-[#1A1A1A] my-4" />
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase">Nueva Contraseña</label>
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="text-[9px] text-[#C9A227] hover:underline flex items-center gap-1"
              >
                {showPassword ? <EyeOff size={10} /> : <Eye size={10} />}
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <input 
              type={showPassword ? "text" : "password"} 
              className={inputCls} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Dejar en blanco para no cambiar" 
            />
          </div>

          {password && (
            <div>
              <label className={labelCls}>Confirmar Contraseña</label>
              <input 
                type={showPassword ? "text" : "password"} 
                className={inputCls} 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Repite la nueva contraseña" 
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={saving} 
            className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors mt-2"
          >
            {saving ? "Guardando…" : "Actualizar Cuenta"}
          </button>
        </form>
      </Modal>
    </div>
  );
}