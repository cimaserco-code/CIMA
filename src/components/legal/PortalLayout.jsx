import React, { useState, useRef } from "react";
import { Outlet } from "react-router-dom";
import { Menu, User, Lock, Save, Eye, EyeOff, Camera, Trash2, Upload } from "lucide-react";
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
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fileInputRef = useRef(null);

  const handleOpenProfile = () => {
    setFullName(profile?.full_name || "");
    setPassword("");
    setConfirmPassword("");
    setAvatarPreview(profile?.avatar_url || "");
    setAvatarFile(null);
    setProfileOpen(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido (JPG, PNG, etc).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no debe superar los 5MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert("Por favor ingresa tu nombre completo.");
      return;
    }

    setSaving(true);
    try {
      let finalAvatarUrl = profile?.avatar_url || null;

      // Upload new avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        
        // Try uploading to 'avatars' bucket
        let { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadErr) {
          // Fallback to 'documents' bucket under avatars/ folder
          const { error: fallbackErr } = await supabase.storage
            .from('documents')
            .upload(`avatars/${fileName}`, avatarFile, { upsert: true });
            
          if (fallbackErr) throw uploadErr || fallbackErr;
          
          const { data } = supabase.storage.from('documents').getPublicUrl(`avatars/${fileName}`);
          finalAvatarUrl = data.publicUrl;
        } else {
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
          finalAvatarUrl = data.publicUrl;
        }
      } else if (avatarPreview === "") {
        finalAvatarUrl = null;
      }

      // 1. Update Profile (Name & Avatar)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          full_name: fullName,
          avatar_url: finalAvatarUrl 
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // 2. Also update team_members for immediate consistency
      await supabase
        .from("team_members")
        .update({ 
          full_name: fullName,
          avatar_url: finalAvatarUrl 
        })
        .eq("user_id", user.id);

      // 3. Optional Password Update
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
        alert("Perfil, fotografía y contraseña actualizados con éxito.");
      } else {
        alert("Perfil actualizado con éxito.");
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
      <PortalSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenProfile={handleOpenProfile} />
      
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

      {/* Bottom Right corner containing Version Watermark */}
      <div className="fixed bottom-3 right-4 text-[#F5F5F3]/10 text-[10px] tracking-[0.2em] uppercase pointer-events-none select-none z-40 font-mono">
        CIMA v.{packageJson.version}
      </div>

      {/* Edit Profile / Account Modal */}
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="Mi Cuenta">
        <form onSubmit={handleSave} className="space-y-4 text-left">
          
          {/* Avatar Photo Upload Section */}
          <div className="flex flex-col items-center justify-center pb-4 border-b border-[#1A1A1A]">
            <div className="relative group mb-3">
              {avatarPreview ? (
                <img 
                  src={avatarPreview} 
                  alt="Foto de perfil" 
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#C9A227] shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#C9A227] flex items-center justify-center text-[#080808] text-2xl font-semibold border-2 border-[#C9A227]/40 shadow-lg">
                  {(fullName || user?.email || "·").charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/60 text-[#F5F5F3] opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[9px] uppercase tracking-wider transition-opacity cursor-pointer gap-1"
              >
                <Camera size={16} className="text-[#C9A227]" />
                <span>Cambiar</span>
              </button>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-[#C9A227] hover:underline flex items-center gap-1.5 px-3 py-1 bg-[#C9A227]/10 border border-[#C9A227]/20 rounded transition-colors"
              >
                <Upload size={12} /> Subir Fotografía
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-xs text-red-400 hover:underline flex items-center gap-1.5 px-3 py-1 bg-red-400/10 border border-red-400/20 rounded transition-colors"
                >
                  <Trash2 size={12} /> Quitar
                </button>
              )}
            </div>
          </div>

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