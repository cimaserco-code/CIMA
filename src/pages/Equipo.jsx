import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Mail, Phone, Users, Pencil } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import { useAuth } from "@/lib/AuthContext";

const roleColors = { 
  admin: "text-[#C9A227] bg-[#C9A227]/10", 
  usuario: "text-[#F5F5F3]/40 bg-[#F5F5F3]/5", 
  "direccion general": "text-[#C9A227] bg-[#C9A227]/10",
  "direccion de area": "text-purple-400 bg-purple-400/10 border-purple-400/20"
};

const EMPTY = { full_name: "", role: "Usuario", email: "", phone: "", bio: "" };

const initials = (name) => name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "·";

export default function Equipo() {
  const { profile } = useAuth();
  const canEditTeam = ["Admin", "Direccion General", "Direccion de Area"].includes(profile?.role);
  const canChangeRole = ["Admin", "Direccion de Area"].includes(profile?.role);

  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // States for viewing member details in pop-up
  const [selectedMember, setSelectedMember] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, rRes, aRes] = await Promise.all([
        supabase.from('team_members').select('*').order('created_at', { ascending: false }),
        supabase.from('role_permissions').select('role').order('role'),
        supabase.from('areas').select('*')
      ]);
      if (mRes.data) {
        // Exclude profiles/team members with 'Cliente' role from appearing in Equipo list
        setMembers(mRes.data.filter(m => m.role !== 'Cliente'));
      }
      if (aRes.data) setAreas(aRes.data);
      if (rRes.data) {
        // Excluir 'Cliente' de los roles de equipo
        const teamRoles = rRes.data.filter(r => r.role !== 'Cliente').map(r => r.role);
        setRoles(teamRoles);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = filterRole === "all" ? members : members.filter((m) => m.role === filterRole);

  const getSelectableRoles = () => {
    if (!editingId) return roles;
    const member = members.find(m => m.id === editingId);
    if (!member || !member.area_id) return ["Admin", "Direccion General", "Direccion de Area", "Usuario"];
    
    const area = areas.find(a => a.id === member.area_id);
    const areaName = area ? area.name.toLowerCase() : "";

    if (areaName.includes("penal")) {
      return ["Abogado/a senior", "Abogado/a junior", "Prestador/a de servicio social", "Admin", "Direccion General", "Direccion de Area", "Usuario"];
    } else if (areaName.includes("blindaje") || areaName.includes("preventivo")) {
      return ["Abogado/a operativa", "Coordinador/a de Litigio Estrategico", "Auxiliar legal", "Director/a", "Abogado/a de Operacion Preventiva", "Admin", "Direccion General", "Direccion de Area", "Usuario"];
    }
    
    return ["Admin", "Direccion General", "Direccion de Area", "Usuario"];
  };

  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({ 
      full_name: m.full_name, 
      role: m.role || (roles[0] || "Usuario"), 
      email: m.email || "", 
      phone: m.phone || "",
      bio: m.bio || ""
    });
    setModalOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name,
        role: form.role,
        email: form.email,
        phone: form.phone,
        bio: form.bio
      };

      if (editingId) {
        const member = members.find(m => m.id === editingId);
        if (member && member.user_id) {
          // If linked to user profile, update profiles (trigger handles team_members sync)
          await supabase.from('profiles').update({
            full_name: payload.full_name,
            role: payload.role,
            phone: payload.phone,
            bio: payload.bio
          }).eq('id', member.user_id);
        } else {
          // Update team_members standalone
          await supabase.from('team_members').update(payload).eq('id', editingId);
        }
      }
      setModalOpen(false); setForm(EMPTY); setEditingId(null); load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  return (
    <div>
      <PageHeader title="Equipo" subtitle={`${members.length} miembros`} />

      <div className="flex flex-wrap gap-2 mb-6">
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]">
          <option value="all">Todos los roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando equipo…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
          {filtered.map((m) => (
            <div 
              key={m.id} 
              onClick={() => { setSelectedMember(m); setDetailsOpen(true); }}
              className="bg-[#080808] border border-[#1A1A1A] p-5 hover:border-[#C9A227]/40 cursor-pointer transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-11 h-11 bg-[#C9A227] flex items-center justify-center text-[#080808] text-sm font-semibold flex-shrink-0">
                    {initials(m.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#F5F5F3] text-sm font-medium group-hover:text-[#C9A227] transition-colors">{m.full_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[9px] tracking-wider uppercase px-2 py-0.5 ${roleColors[m.role?.toLowerCase()] || "text-[#F5F5F3]/40 bg-[#F5F5F3]/5 border border-[#1A1A1A]"}`}>{m.role}</span>
                    </div>
                  </div>
                </div>
                {canEditTeam && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openEdit(m); }} 
                      className="p-1.5 text-[#F5F5F3]/30 hover:text-[#C9A227] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 text-[11px] text-[#F5F5F3]/40">
                {m.email && <span className="flex items-center gap-1.5 truncate"><Mail size={11} />{m.email}</span>}
                {m.phone && <span className="flex items-center gap-1.5"><Phone size={11} />{m.phone}</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-16"><Users size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" /><p className="text-[#F5F5F3]/20 text-sm">Sin miembros</p></div>}
        </div>
      )}
      {/* Edit Member Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Editar Miembro del Equipo">
        <div className="space-y-4">
          <div><label className={labelCls}>Nombre Completo</label><input className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Lic. Juan Pérez" /></div>
          <div>
            <label className={labelCls}>Rol / Posición</label>
            <select 
              className={inputCls} 
              value={form.role} 
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              disabled={!canChangeRole}
            >
               {getSelectableRoles().map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@firma.com" /></div>
          <div><label className={labelCls}>Teléfono</label><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+52 55 1234 5678" /></div>
          <div>
            <label className={labelCls}>Extracto Curricular</label>
            <textarea 
              className={inputCls} 
              rows={3} 
              value={form.bio || ""} 
              onChange={(e) => setForm({ ...form, bio: e.target.value })} 
              placeholder="Ej. Especialista en derecho corporativo y penal..." 
            />
          </div>
          <button onClick={submit} disabled={!form.full_name || saving} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors">{saving ? "Guardando…" : "Guardar Cambios"}</button>
        </div>
      </Modal>

      {/* View Details Pop-Up (Modal) */}
      <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Perfil de Miembro de Equipo">
        {selectedMember && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-[#1A1A1A]">
              <div className="w-16 h-16 bg-[#C9A227] flex items-center justify-center text-[#080808] text-lg font-semibold">
                {initials(selectedMember.full_name)}
              </div>
              <div>
                <h3 className="text-[#F5F5F3] text-lg font-heading">{selectedMember.full_name}</h3>
                <span className={`inline-block text-[9px] tracking-wider uppercase px-2.5 py-0.5 mt-1 border ${roleColors[selectedMember.role?.toLowerCase()] || "text-[#F5F5F3]/40 bg-[#F5F5F3]/5 border border-[#1A1A1A]"}`}>{selectedMember.role}</span>
              </div>
            </div>
            
            <div className="space-y-3 text-xs text-[#F5F5F3]/70 pt-2">
              {selectedMember.email && (
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-[#C9A227]/60" />
                  <a href={`mailto:${selectedMember.email}`} className="hover:text-[#C9A227] transition-colors">{selectedMember.email}</a>
                </div>
              )}
              {selectedMember.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-[#C9A227]/60" />
                  <a href={`tel:${selectedMember.phone}`} className="hover:text-[#C9A227] transition-colors">{selectedMember.phone}</a>
                </div>
              )}
            </div>

            {selectedMember.bio && (
              <div className="pt-4 border-t border-[#1A1A1A]/40 text-left">
                <p className="text-[#F5F5F3]/40 text-[9px] uppercase tracking-wider font-bold mb-1.5">Extracto Curricular</p>
                <p className="text-[#F5F5F3]/80 text-xs leading-relaxed whitespace-pre-line bg-[#0F0F0F] border border-[#1A1A1A] p-3">{selectedMember.bio}</p>
              </div>
            )}

            <div className="pt-4 border-t border-[#1A1A1A]">
              <button 
                type="button" 
                onClick={() => setDetailsOpen(false)} 
                className="w-full border border-[#1A1A1A] text-[#F5F5F3]/40 text-xs tracking-wider uppercase px-4 py-3 hover:text-[#F5F5F3] transition-colors"
              >
                Cerrar Perfil
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}