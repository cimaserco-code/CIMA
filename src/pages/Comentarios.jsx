import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MessageSquare, Plus, CornerDownRight, Filter, AlertCircle, HelpCircle, Check, Send } from "lucide-react";
import PageHeader from "@/components/legal/PageHeader";
import Modal from "@/components/legal/Modal";
import { useAuth } from "@/lib/AuthContext";

const CATEGORIES = ["sugerencia", "cambio", "error", "otro"];

const categoryLabels = {
  sugerencia: "Sugerencia",
  cambio: "Cambio de diseño",
  error: "Reporte de error",
  otro: "Otro"
};

const categoryColors = {
  sugerencia: "text-green-400 bg-green-400/10 border-green-400/20",
  cambio: "text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/20",
  error: "text-red-400 bg-red-400/10 border-red-400/20",
  otro: "text-[#F5F5F3]/40 bg-[#F5F5F3]/5 border-[#1A1A1A]"
};

const categoryIcons = {
  sugerencia: HelpCircle,
  cambio: Filter,
  error: AlertCircle,
  otro: MessageSquare
};

export default function Comentarios() {
  const { profile } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters and Creation states
  const [filterCat, setFilterCat] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("sugerencia");
  const [newContent, setNewContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, pRes, rRes] = await Promise.all([
        supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, role"),
        supabase.from("suggestion_replies").select("*").order("created_at", { ascending: true })
      ]);
      if (sRes.data) setSuggestions(sRes.data);
      if (pRes.data) setProfiles(pRes.data);
      if (rRes.data) setReplies(rRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getProfile = (userId) => {
    return profiles.find(p => p.id === userId) || { full_name: "Usuario del Foro", role: "Usuario" };
  };

  const getInitials = (name) => {
    return name?.split(" ").map(n => n[0]).slice(0, 2).join("") || "·";
  };

  const activeSuggestions = filterCat === "all" ? suggestions : suggestions.filter(s => s.category === filterCat);
  const selectedSuggestion = suggestions.find(s => s.id === selectedId);
  const selectedReplies = replies.filter(r => r.suggestion_id === selectedId);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("suggestions").insert([{
        user_id: profile?.id,
        title: newTitle,
        category: newCategory,
        content: newContent
      }]);
      if (error) throw error;
      setNewTitle("");
      setNewContent("");
      setNewCategory("sugerencia");
      setModalOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      alert("Error al guardar la sugerencia.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !selectedId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("suggestion_replies").insert([{
        suggestion_id: selectedId,
        user_id: profile?.id,
        content: replyContent
      }]);
      if (error) throw error;
      setReplyContent("");
      await load();
    } catch (e) {
      console.error(e);
      alert("Error al enviar la respuesta.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2.5 text-sm text-[#F5F5F3] placeholder:text-[#F5F5F3]/20 focus:outline-none focus:border-[#C9A227] transition-colors";
  const labelCls = "text-[#F5F5F3]/40 text-[10px] tracking-wider uppercase mb-1.5 block";

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Comentarios y Sugerencias" 
        subtitle="Foro de sugerencias de mejora y reporte de errores de la plataforma"
        action={
          <button 
            onClick={() => setModalOpen(true)}
            className="relative overflow-hidden group bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 flex items-center gap-2"
          >
            <span className="absolute inset-0 bg-[#F5F5F3] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10 group-hover:text-[#080808] transition-colors duration-500 flex items-center gap-2">
              <Plus size={15} /> Nueva Propuesta
            </span>
          </button>
        }
      />

      <div className="flex gap-2">
        <select 
          value={filterCat} 
          onChange={(e) => setFilterCat(e.target.value)} 
          className="bg-[#080808] border border-[#1A1A1A] text-[#F5F5F3]/60 text-xs px-3 py-2 focus:outline-none focus:border-[#C9A227]"
        >
          <option value="all">Todas las categorías</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{categoryLabels[cat]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-[#F5F5F3]/30 text-sm">Cargando sugerencias del foro...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* List of Suggestions (Left) */}
          <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {activeSuggestions.map(s => {
              const u = getProfile(s.user_id);
              const repliesCount = replies.filter(r => r.suggestion_id === s.id).length;
              const isSelected = selectedId === s.id;
              const CatIcon = categoryIcons[s.category] || MessageSquare;

              return (
                <div 
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`p-4 bg-[#080808] border transition-colors cursor-pointer text-left block w-full ${isSelected ? "border-[#C9A227]" : "border-[#1A1A1A] hover:border-[#2A2A2A]"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[8px] tracking-wider uppercase px-2 py-0.5 border ${categoryColors[s.category] || ""}`}>
                      {categoryLabels[s.category]}
                    </span>
                    <span className="text-[10px] text-[#F5F5F3]/30">
                      {new Date(s.created_at).toLocaleDateString("es", { day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  <h4 className="text-[#F5F5F3] text-sm font-semibold truncate mb-1">{s.title}</h4>
                  <p className="text-[#F5F5F3]/50 text-xs line-clamp-2 mb-3">{s.content}</p>

                  <div className="flex items-center justify-between border-t border-[#1A1A1A]/50 pt-2 text-[10px] text-[#F5F5F3]/40">
                    <span className="truncate">Por: {u.full_name}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={11} /> {repliesCount}</span>
                  </div>
                </div>
              );
            })}

            {activeSuggestions.length === 0 && (
              <div className="text-center py-16 border border-[#1A1A1A] bg-[#080808] text-[#F5F5F3]/20 text-xs italic">
                Sin publicaciones en esta categoría.
              </div>
            )}
          </div>

          {/* Details & Discussion (Right) */}
          <div className="lg:col-span-2">
            {selectedSuggestion ? (
              <div className="bg-[#080808] border border-[#1A1A1A] p-6 space-y-6 text-left">
                {/* Header */}
                <div className="border-b border-[#1A1A1A] pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-[8px] tracking-wider uppercase px-2.5 py-0.5 border ${categoryColors[selectedSuggestion.category] || ""}`}>
                      {categoryLabels[selectedSuggestion.category]}
                    </span>
                    <span className="text-xs text-[#F5F5F3]/30">
                      Publicado el {new Date(selectedSuggestion.created_at).toLocaleDateString("es", { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <h3 className="text-[#F5F5F3] text-lg font-heading tracking-wide font-semibold">{selectedSuggestion.title}</h3>
                  
                  {/* Author profile */}
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-8 h-8 bg-[#C9A227] flex items-center justify-center text-[#080808] text-xs font-semibold">
                      {getInitials(getProfile(selectedSuggestion.user_id).full_name)}
                    </div>
                    <div>
                      <p className="text-[#F5F5F3] text-xs font-medium">{getProfile(selectedSuggestion.user_id).full_name}</p>
                      <p className="text-[#F5F5F3]/30 text-[9px] uppercase tracking-wider">{getProfile(selectedSuggestion.user_id).role}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <p className="text-[#F5F5F3]/80 text-sm leading-relaxed whitespace-pre-line">{selectedSuggestion.content}</p>

                {/* Replies / Comments section */}
                <div className="space-y-4 border-t border-[#1A1A1A] pt-6">
                  <h4 className="text-[#F5F5F3] text-xs uppercase tracking-wider font-semibold mb-4">Comentarios y Respuestas ({selectedReplies.length})</h4>
                  
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {selectedReplies.map(r => (
                      <div key={r.id} className="flex gap-3 bg-[#0F0F0F] border border-[#1A1A1A]/50 p-4">
                        <div className="w-7 h-7 bg-[#C9A227]/20 border border-[#C9A227]/30 flex items-center justify-center text-[#C9A227] text-xs font-semibold flex-shrink-0">
                          {getInitials(getProfile(r.user_id).full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[#F5F5F3] text-xs font-medium">{getProfile(r.user_id).full_name}</span>
                            <span className="text-[#F5F5F3]/30 text-[9px]">{new Date(r.created_at).toLocaleDateString("es", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[#F5F5F3]/70 text-xs whitespace-pre-line">{r.content}</p>
                        </div>
                      </div>
                    ))}
                    {selectedReplies.length === 0 && (
                      <p className="text-[#F5F5F3]/20 text-xs italic py-4">No hay respuestas aún. Escribe la primera respuesta abajo.</p>
                    )}
                  </div>

                  {/* Add reply form */}
                  <div className="flex items-center gap-2 pt-4 border-t border-[#1A1A1A]/40">
                    <input 
                      type="text"
                      className="flex-1 bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2 text-xs text-[#F5F5F3] focus:outline-none focus:border-[#C9A227]"
                      placeholder="Escribe un comentario..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleReply()}
                    />
                    <button 
                      onClick={handleReply}
                      disabled={!replyContent.trim() || submitting}
                      className="bg-[#C9A227] text-[#080808] p-2 hover:bg-[#A8841D] transition-colors disabled:opacity-40"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-[#080808] border border-[#1A1A1A] p-20 text-center text-[#F5F5F3]/20 flex flex-col justify-center items-center min-h-[400px]">
                <MessageSquare size={36} className="mb-3 opacity-25" />
                <p className="text-sm font-medium">Selecciona un tema del foro</p>
                <p className="text-xs opacity-50 mt-1 max-w-sm">Haz clic en cualquiera de las sugerencias de la izquierda para ver la conversación completa y participar en el foro.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Creation Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Propuesta o Sugerencia">
        <div className="space-y-4 text-left">
          <div>
            <label className={labelCls}>Título del Comentario</label>
            <input 
              className={inputCls} 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              placeholder="Ej. Rediseñar el buscador de Casos" 
              required 
            />
          </div>
          <div>
            <label className={labelCls}>Categoría</label>
            <select 
              className={inputCls} 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value)}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{categoryLabels[cat]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Descripción o Cambios Sugeridos</label>
            <textarea 
              className={inputCls} 
              rows={4}
              value={newContent} 
              onChange={(e) => setNewContent(e.target.value)} 
              placeholder="Describe detalladamente qué cambios propones o qué reporte deseas realizar en la plataforma..."
              required
            />
          </div>

          <button 
            onClick={handleCreate} 
            disabled={!newTitle.trim() || !newContent.trim() || submitting} 
            className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors"
          >
            {submitting ? "Guardando…" : "Publicar Comentario"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
