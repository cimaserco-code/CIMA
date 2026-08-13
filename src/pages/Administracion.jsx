import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Shield, Users, Mail, Pencil, Search, Check, UserPlus, Lock, Save, Folder, Plus, Trash, Eye } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";

export default function Administracion() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [perms, setPerms] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("usuarios");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState("Usuario");
  const [editingUserArea, setEditingUserArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Usuario");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  // States for Areas Management
  const [newAreaName, setNewAreaName] = useState("");
  const [editingArea, setEditingArea] = useState(null);
  const [editAreaName, setEditAreaName] = useState("");
  const [creatingArea, setCreatingArea] = useState(false);

  // States for Roles Management
  const [newRoleName, setNewRoleName] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [uRes, pRes, aRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('role_permissions').select('*').order('role'),
        supabase.from('areas').select('*').order('created_at', { ascending: false })
      ]);
      if (uRes.data) setUsers(uRes.data);
      if (pRes.data) setPerms(pRes.data);
      if (aRes.data) setAreas(aRes.data);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar los datos de administración.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const matchesSearch = (u.full_name || u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const openEdit = (u) => {
    setEditingUser(u);
    setEditRole(u.role || "Usuario");
    setEditingUserArea(u.area_id || "");
  };

  const submitRole = async () => {
    setSaving(true);
    try {
      await supabase.from('profiles').update({ 
        role: editRole,
        area_id: editingUserArea || null 
      }).eq('id', editingUser.id);
      
      setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, role: editRole, area_id: editingUserArea } : u)));
      setEditingUser(null);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error al actualizar el usuario.");
    } finally { setSaving(false); }
  };

  const submitInvite = async () => {
    setInviting(true);
    setInviteMsg("");
    try {
      setInviteMsg(`Invitación registrada para ${inviteEmail}. El usuario puede crearse su cuenta.`);
      setInviteEmail("");
      setInviteRole("Usuario");
    } catch (e) {
      console.error(e);
      setInviteMsg(e.message || "Error al enviar la invitación.");
    } finally { setInviting(false); }
  };

  const togglePerm = (role, key) => {
    setPerms((draft) =>
      draft.map((p) =>
        p.role === role
          ? { ...p, [key]: !p[key] }
          : p
      )
    );
  };

  const savePerms = async () => {
    setSaving(true);
    try {
      const updates = perms.map((p) => supabase.from('role_permissions').update({
        can_manage_users: p.can_manage_users,
        can_view_all_cases: p.can_view_all_cases,
        
        can_view_cases: p.can_view_cases,
        can_create_cases: p.can_create_cases,
        can_edit_cases: p.can_edit_cases,
        can_delete_cases: p.can_delete_cases,
        
        can_view_tasks: p.can_view_tasks,
        can_create_tasks: p.can_create_tasks,
        can_edit_tasks: p.can_edit_tasks,
        can_delete_tasks: p.can_delete_tasks,
        
        can_view_documents: p.can_view_documents,
        can_create_documents: p.can_create_documents,
        can_edit_documents: p.can_edit_documents,
        can_delete_documents: p.can_delete_documents,
        
        can_view_fees: p.can_view_fees,
        can_create_fees: p.can_create_fees,
        can_edit_fees: p.can_edit_fees,
        can_delete_fees: p.can_delete_fees,
        
        can_view_clients: p.can_view_clients,
        can_create_clients: p.can_create_clients,
        can_edit_clients: p.can_edit_clients,
        can_delete_clients: p.can_delete_clients,
      }).eq('id', p.id));
      await Promise.all(updates);
      load();
    } catch (e) {
      console.error(e);
      setError("Error al guardar permisos.");
    } finally { setSaving(false); }
  };

  // Area CRUD Handlers
  const handleCreateArea = async (e) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    setCreatingArea(true);
    try {
      const { data, error } = await supabase.from('areas').insert({ name: newAreaName.trim() }).select();
      if (error) throw error;
      if (data) setAreas([data[0], ...areas]);
      setNewAreaName("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al crear el área.");
    } finally { setCreatingArea(false); }
  };

  const handleDeleteArea = async (id) => {
    if (!confirm("¿Estás seguro de eliminar esta área? Los usuarios y casos de esta área quedarán sin área asignada.")) return;
    try {
      const { error } = await supabase.from('areas').delete().eq('id', id);
      if (error) throw error;
      setAreas(areas.filter(a => a.id !== id));
      load();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al eliminar el área.");
    }
  };

  const handleUpdateArea = async (e) => {
    e.preventDefault();
    if (!editAreaName.trim() || !editingArea) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('areas').update({ name: editAreaName.trim() }).eq('id', editingArea.id);
      if (error) throw error;
      setAreas(areas.map(a => a.id === editingArea.id ? { ...a, name: editAreaName.trim() } : a));
      setEditingArea(null);
      setEditAreaName("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al actualizar el área.");
    } finally { setSaving(false); }
  };

  // Dynamic Roles CRUD Handlers
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      const { data, error } = await supabase.from('role_permissions').insert({
        role: newRoleName.trim(),
        can_manage_users: false,
        can_view_all_cases: false,
        
        can_view_cases: true,
        can_create_cases: true,
        can_edit_cases: true,
        can_delete_cases: false,
        
        can_view_tasks: true,
        can_create_tasks: true,
        can_edit_tasks: true,
        can_delete_tasks: false,
        
        can_view_documents: true,
        can_create_documents: true,
        can_edit_documents: true,
        can_delete_documents: false,
        
        can_view_fees: true,
        can_create_fees: true,
        can_edit_fees: true,
        can_delete_fees: false,
        
        can_view_clients: true,
        can_create_clients: true,
        can_edit_clients: true,
        can_delete_clients: false
      }).select();
      if (error) throw error;
      if (data) setPerms([...perms, data[0]]);
      setNewRoleName("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al crear el rol.");
    } finally { setCreatingRole(false); }
  };

  const handleDeleteRole = async (roleName) => {
    if (roleName === "Admin") {
      alert("No se puede eliminar el rol Administrador principal.");
      return;
    }
    if (!confirm(`¿Estás seguro de eliminar el rol "${roleName}"? Los usuarios asociados a este rol perderán sus permisos.`)) return;
    try {
      const { error } = await supabase.from('role_permissions').delete().eq('role', roleName);
      if (error) throw error;
      setPerms(perms.filter(p => p.role !== roleName));
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al eliminar el rol.");
    }
  };

  const roleBadge = (role) =>
    role === "Admin" || role === "Direccion General"
      ? "text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/20"
      : role === "Direccion de Area"
      ? "text-purple-400 bg-purple-400/10 border border-purple-400/20"
      : role === "Cliente"
      ? "text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20"
      : "text-[#F5F5F3]/40 bg-[#F5F5F3]/5 border border-[#1A1A1A]";

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  return (
    <div>
      <PageHeader
        title="Administración"
        subtitle="Gestión de usuarios, áreas, roles y permisos"
        action={
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/vista-cliente")} 
              className="bg-transparent border border-[#1A1A1A] hover:border-[#C9A227] hover:text-[#C9A227] text-[#F5F5F3]/60 text-xs tracking-wider uppercase px-4 py-3 flex items-center gap-2 transition-colors duration-300"
            >
              <Eye size={14} /> Vista Cliente
            </button>
            <span className="hidden sm:flex items-center gap-2 text-[10px] tracking-wider uppercase text-[#C9A227] bg-[#C9A227]/10 px-3 py-2 border border-[#C9A227]/20">
              <Shield size={13} /> Panel de Control
            </span>
            {tab === "usuarios" && (
              <button onClick={() => { setInviteOpen(true); setInviteMsg(""); }} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
                <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2"><UserPlus size={15} /> Invitar Usuario</span>
              </button>
            )}
          </div>
        }
      />

      <div className="flex gap-1 bg-[#080808] border border-[#1A1A1A] mb-6 w-fit flex-wrap">
        <button onClick={() => setTab("usuarios")} className={`flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-wider uppercase transition-colors ${tab === "usuarios" ? "bg-[#C9A227] text-[#080808]" : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"}`}><Users size={13} /> Usuarios</button>
        <button onClick={() => setTab("areas")} className={`flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-wider uppercase transition-colors ${tab === "areas" ? "bg-[#C9A227] text-[#080808]" : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"}`}><Folder size={13} /> Áreas</button>
        <button onClick={() => setTab("permisos")} className={`flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-wider uppercase transition-colors ${tab === "permisos" ? "bg-[#C9A227] text-[#080808]" : "text-[#F5F5F3]/40 hover:text-[#F5F5F3]"}`}><Lock size={13} /> Roles y Permisos</button>
      </div>

      {error && !loading && (
        <div className="bg-red-400/5 border border-red-400/20 p-6 text-center mb-6">
          <Shield size={28} className="text-red-400/40 mx-auto mb-2" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {tab === "usuarios" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-[2px] mb-8">
            <div className="bg-[#080808] border border-[#1A1A1A] p-5">
              <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">Total Usuarios</span>
              <p className="text-[#F5F5F3] text-2xl font-heading font-light mt-2">{users.length}</p>
            </div>
            <div className="bg-[#080808] border border-[#1A1A1A] p-5">
              <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">Administradores</span>
              <p className="text-[#C9A227] text-2xl font-heading font-light mt-2">{users.filter((u) => u.role === "Admin" || u.role === "Direccion General").length}</p>
            </div>
            <div className="bg-[#080808] border border-[#1A1A1A] p-5">
              <span className="text-[#F5F5F3]/30 text-[10px] tracking-[0.2em] uppercase">Otros Roles</span>
              <p className="text-[#F5F5F3] text-2xl font-heading font-light mt-2">{users.filter((u) => u.role !== "Admin" && u.role !== "Direccion General").length}</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F5F5F3]/20" />
              <input className="w-full bg-[#080808] border border-[#1A1A1A] pl-11 pr-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors" placeholder="Buscar por nombre o email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-4 py-2.5 focus:outline-none focus:border-[#C9A227]">
              <option value="all">Todos los roles</option>
              {perms.map(p => (
                <option key={p.role} value={p.role}>{p.role}</option>
              ))}
            </select>
          </div>

          {loading ? <p className="text-[#F5F5F3]/30 text-sm">Cargando usuarios…</p> : !error && (
            <div className="bg-[#080808] border border-[#1A1A1A]">
              <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#1A1A1A] bg-[#0F0F0F]/30">
                <span className="col-span-3 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase">Usuario</span>
                <span className="col-span-3 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase">Email</span>
                <span className="col-span-2 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase">Área</span>
                <span className="col-span-2 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase">Rol</span>
                <span className="col-span-2 text-[#F5F5F3]/30 text-[10px] tracking-wider uppercase text-right">Acciones</span>
              </div>
              {filtered.map((u) => (
                <div key={u.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-4 border-b border-[#1A1A1A] last:border-0 items-center hover:bg-[#0F0F0F] transition-colors">
                  <div className="md:col-span-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#C9A227] flex items-center justify-center text-[#080808] text-xs font-semibold flex-shrink-0">{(u.full_name || u.email || "?").charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="text-[#F5F5F3] text-sm truncate">{u.full_name || "Sin nombre"}</p>
                      <p className="text-[#F5F5F3]/20 text-[10px] md:hidden truncate flex items-center gap-1"><Mail size={10} />{u.email}</p>
                    </div>
                  </div>
                  <div className="md:col-span-3 text-[#F5F5F3]/40 text-xs hidden md:flex items-center gap-1.5 truncate"><Mail size={11} />{u.email}</div>
                  <div className="md:col-span-2 text-xs text-[#F5F5F3]/60 truncate">
                    {perms.find(p => p.role === u.role)?.can_view_all_cases ? (
                      <span className="text-[#C9A227] font-medium">Todas las Áreas</span>
                    ) : (
                      areas.find(a => a.id === u.area_id)?.name || <span className="text-[#F5F5F3]/10 italic">Sin Área</span>
                    )}
                  </div>
                  <div className="md:col-span-2"><span className={`text-[9px] tracking-wider uppercase px-2.5 py-1 ${roleBadge(u.role)}`}>{u.role}</span></div>
                  <div className="md:col-span-2 flex md:justify-end">
                    <button onClick={() => openEdit(u)} className="flex items-center gap-1.5 text-[#F5F5F3]/40 hover:text-[#C9A227] text-[10px] tracking-wider uppercase transition-colors"><Pencil size={13} /> Editar Rol/Área</button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="text-center py-16"><Users size={32} className="text-[#F5F5F3]/10 mx-auto mb-3" /><p className="text-[#F5F5F3]/20 text-sm">Sin resultados</p></div>}
            </div>
          )}
        </>
      )}

      {tab === "areas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-[#080808] border border-[#1A1A1A] p-6 h-fit">
            <h3 className="text-[#F5F5F3] text-sm font-heading mb-4 uppercase tracking-wider">Crear Nueva Área</h3>
            <form onSubmit={handleCreateArea} className="space-y-4">
              <div>
                <label className={labelCls}>Nombre de Área</label>
                <input 
                  type="text" 
                  value={newAreaName} 
                  onChange={(e) => setNewAreaName(e.target.value)} 
                  className={inputCls} 
                  placeholder="Ej. Corporativo, Fiscal, Penal..." 
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={creatingArea || !newAreaName.trim()} 
                className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 hover:bg-[#A8841D] transition-colors flex items-center justify-center gap-2 disabled:opacity-30"
              >
                <Plus size={15} /> {creatingArea ? "Creando..." : "Crear Área"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#080808] border border-[#1A1A1A] p-6">
              <h3 className="text-[#F5F5F3] text-sm font-heading mb-4 uppercase tracking-wider">Listado de Áreas</h3>
              {loading ? (
                <p className="text-[#F5F5F3]/30 text-xs">Cargando áreas...</p>
              ) : (
                <div className="space-y-3">
                  {areas.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-4 bg-[#0F0F0F] border border-[#1A1A1A] hover:border-[#2A2A2A] transition-colors">
                      {editingArea?.id === a.id ? (
                        <form onSubmit={handleUpdateArea} className="flex items-center gap-3 w-full">
                          <input 
                            type="text" 
                            value={editAreaName} 
                            onChange={(e) => setEditAreaName(e.target.value)} 
                            className="flex-1 bg-[#080808] border border-[#C9A227] px-3 py-1.5 text-xs text-[#F5F5F3] focus:outline-none"
                            required
                          />
                          <button type="submit" disabled={saving} className="bg-[#C9A227] text-[#080808] px-3 py-1.5 text-xs uppercase tracking-wider font-semibold">Guardar</button>
                          <button type="button" onClick={() => setEditingArea(null)} className="border border-[#1A1A1A] text-[#F5F5F3]/40 px-3 py-1.5 text-xs uppercase tracking-wider">Cancelar</button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <Folder size={16} className="text-[#C9A227]/60" />
                            <span className="text-[#F5F5F3] text-sm font-medium">{a.name}</span>
                            <span className="text-[#F5F5F3]/20 text-[10px]">
                              ({users.filter(u => u.area_id === a.id).length} usuarios asociados)
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => { setEditingArea(a); setEditAreaName(a.name); }} 
                              className="text-[#F5F5F3]/40 hover:text-[#C9A227] text-[10px] tracking-wider uppercase transition-colors"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => handleDeleteArea(a.id)} 
                              className="text-red-400/40 hover:text-red-400 text-[10px] tracking-wider uppercase transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {areas.length === 0 && (
                    <div className="text-center py-12 border border-dashed border-[#1A1A1A]">
                      <Folder size={24} className="text-[#F5F5F3]/10 mx-auto mb-2" />
                      <p className="text-[#F5F5F3]/20 text-xs">No hay áreas creadas.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "permisos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-[#080808] border border-[#1A1A1A] p-6 h-fit">
            <h3 className="text-[#F5F5F3] text-sm font-heading mb-4 uppercase tracking-wider">Crear Nuevo Rol</h3>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className={labelCls}>Nombre del Rol</label>
                <input 
                  type="text" 
                  value={newRoleName} 
                  onChange={(e) => setNewRoleName(e.target.value)} 
                  className={inputCls} 
                  placeholder="Ej. Abogado Senior, Auditor..." 
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={creatingRole || !newRoleName.trim()} 
                className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 hover:bg-[#A8841D] transition-colors flex items-center justify-center gap-2 disabled:opacity-30"
              >
                <Plus size={15} /> {creatingRole ? "Creando..." : "Crear Rol"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3 bg-[#080808] border border-[#1A1A1A] p-4">
              <p className="text-[#F5F5F3]/40 text-[11px] max-w-sm">Define y activa las capacidades y accesos globales de cada rol creado.</p>
              <button onClick={savePerms} disabled={saving} className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2">
                <span className="relative z-10 flex items-center gap-2"><Save size={15} /> Guardar Permisos</span>
              </button>
            </div>

            <div className="bg-[#080808] border border-[#1A1A1A] p-6 space-y-6">
              {perms.map((p) => (
                <div key={p.id} className="border-b border-[#1A1A1A] pb-6 last:border-0 last:pb-0 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[#C9A227] text-sm font-heading uppercase tracking-wider">{p.role}</h3>
                    {p.role !== "Admin" && (
                      <button 
                        type="button"
                        onClick={() => handleDeleteRole(p.role)} 
                        className="text-red-400/40 hover:text-red-400 text-[10px] tracking-wider uppercase flex items-center gap-1 transition-colors"
                      >
                        <Trash size={12} /> Eliminar Rol
                      </button>
                    )}
                  </div>
                  
                  {/* Permissions Matrices grouped by modules */}
                  <div className="space-y-4 text-xs text-[#F5F5F3]/70">
                    {/* ACCESO GLOBAL */}
                    <div className="bg-[#0F0F0F] p-3 border border-[#1A1A1A] space-y-2">
                      <span className="text-[#C9A227] text-[10px] tracking-wider uppercase font-semibold">Configuración Global</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={!!p.can_manage_users} onChange={() => togglePerm(p.role, 'can_manage_users')} />
                          <span>Gestionar Usuarios (Acceso Administración)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={!!p.can_view_all_cases} onChange={() => togglePerm(p.role, 'can_view_all_cases')} />
                          <span>Ver Todos los Datos (Bypass de Área)</span>
                        </label>
                      </div>
                    </div>

                    {/* MATRICES POR MÓDULO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Casos */}
                      <div className="bg-[#0F0F0F]/50 p-3 border border-[#1A1A1A]/80 space-y-2">
                        <span className="text-[#F5F5F3]/40 text-[9px] tracking-wider uppercase font-bold">Casos</span>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_view_cases} onChange={() => togglePerm(p.role, 'can_view_cases')} /> <span>Ver</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_create_cases} onChange={() => togglePerm(p.role, 'can_create_cases')} /> <span>Crear</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_edit_cases} onChange={() => togglePerm(p.role, 'can_edit_cases')} /> <span>Editar</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_delete_cases} onChange={() => togglePerm(p.role, 'can_delete_cases')} /> <span>Borrar</span></label>
                        </div>
                      </div>

                      {/* Tareas */}
                      <div className="bg-[#0F0F0F]/50 p-3 border border-[#1A1A1A]/80 space-y-2">
                        <span className="text-[#F5F5F3]/40 text-[9px] tracking-wider uppercase font-bold">Tareas y Términos</span>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_view_tasks} onChange={() => togglePerm(p.role, 'can_view_tasks')} /> <span>Ver</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_create_tasks} onChange={() => togglePerm(p.role, 'can_create_tasks')} /> <span>Crear</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_edit_tasks} onChange={() => togglePerm(p.role, 'can_edit_tasks')} /> <span>Editar</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_delete_tasks} onChange={() => togglePerm(p.role, 'can_delete_tasks')} /> <span>Borrar</span></label>
                        </div>
                      </div>

                      {/* Documentos */}
                      <div className="bg-[#0F0F0F]/50 p-3 border border-[#1A1A1A]/80 space-y-2">
                        <span className="text-[#F5F5F3]/40 text-[9px] tracking-wider uppercase font-bold">Documentos</span>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_view_documents} onChange={() => togglePerm(p.role, 'can_view_documents')} /> <span>Ver</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_create_documents} onChange={() => togglePerm(p.role, 'can_create_documents')} /> <span>Crear</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_edit_documents} onChange={() => togglePerm(p.role, 'can_edit_documents')} /> <span>Editar</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_delete_documents} onChange={() => togglePerm(p.role, 'can_delete_documents')} /> <span>Borrar</span></label>
                        </div>
                      </div>

                      {/* Honorarios */}
                      <div className="bg-[#0F0F0F]/50 p-3 border border-[#1A1A1A]/80 space-y-2">
                        <span className="text-[#F5F5F3]/40 text-[9px] tracking-wider uppercase font-bold">Honorarios</span>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_view_fees} onChange={() => togglePerm(p.role, 'can_view_fees')} /> <span>Ver</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_create_fees} onChange={() => togglePerm(p.role, 'can_create_fees')} /> <span>Crear</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_edit_fees} onChange={() => togglePerm(p.role, 'can_edit_fees')} /> <span>Editar</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_delete_fees} onChange={() => togglePerm(p.role, 'can_delete_fees')} /> <span>Borrar</span></label>
                        </div>
                      </div>

                      {/* Clientes */}
                      <div className="bg-[#0F0F0F]/50 p-3 border border-[#1A1A1A]/80 space-y-2 col-span-1 md:col-span-2">
                        <span className="text-[#F5F5F3]/40 text-[9px] tracking-wider uppercase font-bold">Clientes</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_view_clients} onChange={() => togglePerm(p.role, 'can_view_clients')} /> <span>Ver</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_create_clients} onChange={() => togglePerm(p.role, 'can_create_clients')} /> <span>Crear</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_edit_clients} onChange={() => togglePerm(p.role, 'can_edit_clients')} /> <span>Editar</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!p.can_delete_clients} onChange={() => togglePerm(p.role, 'can_delete_clients')} /> <span>Borrar</span></label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title="Editar Usuario (Rol y Área)">
        {editingUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#1A1A1A]">
              <div className="w-12 h-12 bg-[#C9A227] flex items-center justify-center text-[#080808] text-sm font-semibold">{(editingUser.full_name || editingUser.email || "?").charAt(0).toUpperCase()}</div>
              <div className="min-w-0">
                <p className="text-[#F5F5F3] text-sm">{editingUser.full_name || "Sin nombre"}</p>
                <p className="text-[#F5F5F3]/30 text-xs truncate">{editingUser.email}</p>
              </div>
            </div>
            <div>
              <label className={labelCls}>Rol de Usuario</label>
              <select 
                value={editRole} 
                onChange={(e) => setEditRole(e.target.value)} 
                className="w-full bg-[#0F0F0F] border border-[#1A1A1A] text-sm text-[#F5F5F3] px-3 py-2.5 focus:outline-none focus:border-[#C9A227]"
              >
                {perms.map(p => (
                  <option key={p.role} value={p.role}>{p.role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Área Asignada</label>
              <select 
                value={editingUserArea} 
                onChange={(e) => setEditingUserArea(e.target.value)} 
                className="w-full bg-[#0F0F0F] border border-[#1A1A1A] text-sm text-[#F5F5F3] px-3 py-2.5 focus:outline-none focus:border-[#C9A227]"
              >
                <option value="">Sin Área Asignada</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditingUser(null)} className="flex-1 border border-[#1A1A1A] text-[#F5F5F3]/40 text-xs tracking-wider uppercase px-4 py-3 hover:text-[#F5F5F3] transition-colors">Cancelar</button>
              <button type="button" onClick={submitRole} disabled={saving} className="flex-1 bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-4 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors flex items-center justify-center gap-2">{saving ? "Guardando…" : <><Check size={14} /> Guardar</>}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invitar Nuevo Usuario">
        <div className="space-y-4">
          <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="correo@empresa.com" /></div>
          <div><label className={labelCls}>Rol</label>
            <select 
              value={inviteRole} 
              onChange={(e) => setInviteRole(e.target.value)} 
              className="w-full bg-[#0F0F0F] border border-[#1A1A1A] text-sm text-[#F5F5F3] px-3 py-2.5 focus:outline-none focus:border-[#C9A227]"
            >
              {perms.map(p => (
                <option key={p.role} value={p.role}>{p.role}</option>
              ))}
            </select>
          </div>
          {inviteMsg && <p className="text-xs text-green-400">{inviteMsg}</p>}
          <button onClick={submitInvite} disabled={!inviteEmail || inviting} className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors flex items-center justify-center gap-2">{inviting ? "Enviando…" : <><UserPlus size={15} /> Registrar Invitación</>}</button>
        </div>
      </Modal>
    </div>
  );
}