import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  MessageSquare, Plus, CornerDownRight, Filter, AlertCircle, HelpCircle, 
  Check, Send, Image as ImageIcon, Upload, X, Maximize2, ExternalLink, Loader2 
} from "lucide-react";
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

export function parseContentWithImages(rawContent = "") {
  if (!rawContent) return { text: "", images: [] };

  // Check for CIMA images tag: <!--cima_images:[...]-->
  const match = rawContent.match(/<!--cima_images:(.*?)-->/s);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      const cleanText = rawContent.replace(/<!--cima_images:.*?-->/s, "").trim();
      return {
        text: cleanText,
        images: Array.isArray(parsed) ? parsed : [parsed].filter(Boolean)
      };
    } catch (e) {
      console.warn("Error parsing embedded images:", e);
    }
  }

  // Also check if content contains markdown images: ![...](url)
  const mdImgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const foundMdImages = [];
  let mdMatch;
  while ((mdMatch = mdImgRegex.exec(rawContent)) !== null) {
    foundMdImages.push(mdMatch[1]);
  }
  if (foundMdImages.length > 0) {
    const cleanText = rawContent.replace(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g, "").trim();
    return { text: cleanText, images: foundMdImages };
  }

  return { text: rawContent, images: [] };
}

export function formatContentWithImages(text = "", images = []) {
  const trimmed = text.trim();
  if (!images || images.length === 0) return trimmed;
  return `${trimmed}\n\n<!--cima_images:${JSON.stringify(images)}-->`;
}

export default function Comentarios() {
  const { profile } = useAuth();
  
  if (profile?.role === "Cliente") {
    return (
      <div className="bg-[#080808] border border-red-500/20 p-10 text-center text-[#F5F5F3]/30">
        <AlertCircle size={36} className="mx-auto mb-3 text-red-500 opacity-60" />
        <p className="text-sm font-medium text-red-400">Acceso Denegado</p>
        <p className="text-xs opacity-50 mt-2 max-w-md mx-auto">Los usuarios con rol de cliente no tienen permitido ingresar al foro de sugerencias y comentarios.</p>
      </div>
    );
  }

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
  const [newImages, setNewImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Reply states
  const [replyContent, setReplyContent] = useState("");
  const [replyImages, setReplyImages] = useState([]);
  const [uploadingReplyImage, setUploadingReplyImage] = useState(false);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, pRes, rRes] = await Promise.all([
        supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, role, avatar_url"),
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

  const uploadImageFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("La imagen es demasiado grande. El límite es de 10 MB.");
      return null;
    }

    try {
      const fileExt = file.name ? file.name.split('.').pop() : 'png';
      const fileName = `comments_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `suggestions/${fileName}`;

      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return publicData.publicUrl;
    } catch (err) {
      console.error("Error al subir imagen:", err);
      alert("Error al subir la imagen: " + (err.message || err));
      return null;
    }
  };

  const handlePasteImage = async (e, setImagesList, setUploadingState) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          setUploadingState(true);
          try {
            const url = await uploadImageFile(file);
            if (url) {
              setImagesList(prev => [...prev, url]);
            }
          } finally {
            setUploadingState(false);
          }
          break;
        }
      }
    }
  };

  const activeSuggestions = filterCat === "all" ? suggestions : suggestions.filter(s => s.category === filterCat);
  const selectedSuggestion = suggestions.find(s => s.id === selectedId);
  const selectedReplies = replies.filter(r => r.suggestion_id === selectedId);

  const handleCreate = async () => {
    if (!newTitle.trim() || (!newContent.trim() && newImages.length === 0)) return;
    setSubmitting(true);
    try {
      const fullContent = formatContentWithImages(newContent, newImages);
      const { error } = await supabase.from("suggestions").insert([{
        user_id: profile?.id,
        title: newTitle,
        category: newCategory,
        content: fullContent
      }]);
      if (error) throw error;
      setNewTitle("");
      setNewContent("");
      setNewCategory("sugerencia");
      setNewImages([]);
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
    if ((!replyContent.trim() && replyImages.length === 0) || !selectedId) return;
    setSubmitting(true);
    try {
      const fullReplyContent = formatContentWithImages(replyContent, replyImages);
      const { error } = await supabase.from("suggestion_replies").insert([{
        suggestion_id: selectedId,
        user_id: profile?.id,
        content: fullReplyContent
      }]);
      if (error) throw error;
      setReplyContent("");
      setReplyImages([]);
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
              const parsed = parseContentWithImages(s.content);

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
                  <p className="text-[#F5F5F3]/50 text-xs line-clamp-2 mb-3">{parsed.text || s.content}</p>

                  <div className="flex items-center justify-between border-t border-[#1A1A1A]/50 pt-2 text-[10px] text-[#F5F5F3]/40">
                    <span className="truncate">Por: {u.full_name}</span>
                    <div className="flex items-center gap-2.5">
                      {parsed.images.length > 0 && (
                        <span className="flex items-center gap-1 text-[#C9A227]" title={`${parsed.images.length} captura(s) adjunta(s)`}>
                          <ImageIcon size={11} /> {parsed.images.length}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><MessageSquare size={11} /> {repliesCount}</span>
                    </div>
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
            {selectedSuggestion ? (() => {
              const parsedSelected = parseContentWithImages(selectedSuggestion.content);
              return (
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
                      {getProfile(selectedSuggestion.user_id).avatar_url ? (
                        <img 
                          src={getProfile(selectedSuggestion.user_id).avatar_url} 
                          alt="Avatar" 
                          className="w-8 h-8 rounded-full object-cover border border-[#C9A227]/40 flex-shrink-0" 
                        />
                      ) : (
                        <div className="w-8 h-8 bg-[#C9A227] flex items-center justify-center text-[#080808] text-xs font-semibold flex-shrink-0">
                          {getInitials(getProfile(selectedSuggestion.user_id).full_name)}
                        </div>
                      )}
                      <div>
                        <p className="text-[#F5F5F3] text-xs font-medium">{getProfile(selectedSuggestion.user_id).full_name}</p>
                        <p className="text-[#F5F5F3]/30 text-[9px] uppercase tracking-wider">{getProfile(selectedSuggestion.user_id).role}</p>
                      </div>
                    </div>
                  </div>

                  {/* Text Content */}
                  {parsedSelected.text && (
                    <p className="text-[#F5F5F3]/80 text-sm leading-relaxed whitespace-pre-line">{parsedSelected.text}</p>
                  )}

                  {/* Images / Screenshots Gallery */}
                  {parsedSelected.images.length > 0 && (
                    <div className="space-y-3 border-t border-[#1A1A1A] pt-4">
                      <p className="text-[#F5F5F3]/40 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <ImageIcon size={12} className="text-[#C9A227]" />
                        Capturas y Referencias del Cambio ({parsedSelected.images.length})
                      </p>
                      <div className={`grid gap-3 ${parsedSelected.images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                        {parsedSelected.images.map((imgUrl, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setLightboxUrl(imgUrl)}
                            className="group relative cursor-pointer overflow-hidden border border-[#1A1A1A] bg-[#0F0F0F] hover:border-[#C9A227]/60 transition-all max-h-96 flex items-center justify-center"
                          >
                            <img 
                              src={imgUrl} 
                              alt={`Captura ${idx + 1}`} 
                              className="w-full h-auto max-h-96 object-contain transition-transform duration-300 group-hover:scale-[1.01]" 
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <span className="bg-[#080808]/90 text-[#F5F5F3] text-xs px-3 py-1.5 border border-[#C9A227]/40 flex items-center gap-1.5 shadow-lg">
                                <Maximize2 size={13} className="text-[#C9A227]" /> Ver captura completa
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Replies / Comments section */}
                  <div className="space-y-4 border-t border-[#1A1A1A] pt-6">
                    <h4 className="text-[#F5F5F3] text-xs uppercase tracking-wider font-semibold mb-4">Comentarios y Respuestas ({selectedReplies.length})</h4>
                    
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                      {selectedReplies.map(r => {
                        const replyData = parseContentWithImages(r.content);
                        const ru = getProfile(r.user_id);
                        return (
                          <div key={r.id} className="flex gap-3 bg-[#0F0F0F] border border-[#1A1A1A]/50 p-4">
                            {ru.avatar_url ? (
                              <img 
                                src={ru.avatar_url} 
                                alt="Avatar" 
                                className="w-7 h-7 rounded-full object-cover border border-[#C9A227]/30 flex-shrink-0" 
                              />
                            ) : (
                              <div className="w-7 h-7 bg-[#C9A227]/20 border border-[#C9A227]/30 flex items-center justify-center text-[#C9A227] text-xs font-semibold flex-shrink-0">
                                {getInitials(ru.full_name)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[#F5F5F3] text-xs font-medium">{ru.full_name}</span>
                                <span className="text-[#F5F5F3]/30 text-[9px]">{new Date(r.created_at).toLocaleDateString("es", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {replyData.text && <p className="text-[#F5F5F3]/70 text-xs whitespace-pre-line">{replyData.text}</p>}
                              {replyData.images.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  {replyData.images.map((imgUrl, imgIdx) => (
                                    <div 
                                      key={imgIdx} 
                                      onClick={() => setLightboxUrl(imgUrl)}
                                      className="group relative cursor-pointer border border-[#1A1A1A] bg-[#080808] hover:border-[#C9A227]/60 transition-colors w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center overflow-hidden"
                                    >
                                      <img 
                                        src={imgUrl} 
                                        alt="Adjunto" 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Maximize2 size={13} className="text-white" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {selectedReplies.length === 0 && (
                        <p className="text-[#F5F5F3]/20 text-xs italic py-4">No hay respuestas aún. Escribe la primera respuesta abajo.</p>
                      )}
                    </div>

                    {/* Add reply form */}
                    <div className="space-y-2 pt-4 border-t border-[#1A1A1A]/40">
                      {replyImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-[#080808] border border-[#1A1A1A]">
                          {replyImages.map((img, idx) => (
                            <div key={idx} className="relative group w-14 h-14 border border-[#1A1A1A]">
                              <img src={img} alt="Adjunto respuesta" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setReplyImages(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 shadow hover:bg-red-700 transition-colors"
                                title="Quitar imagen"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <label 
                          className={`p-2 bg-[#0F0F0F] border border-[#1A1A1A] text-[#F5F5F3]/40 hover:text-[#C9A227] hover:border-[#C9A227]/40 transition-colors cursor-pointer flex-shrink-0 ${uploadingReplyImage ? 'opacity-40 pointer-events-none' : ''}`}
                          title="Adjuntar imagen o captura a la respuesta"
                        >
                          {uploadingReplyImage ? <Loader2 size={15} className="animate-spin text-[#C9A227]" /> : <ImageIcon size={15} />}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            disabled={uploadingReplyImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setUploadingReplyImage(true);
                                const url = await uploadImageFile(file);
                                if (url) setReplyImages(prev => [...prev, url]);
                                setUploadingReplyImage(false);
                                e.target.value = "";
                              }
                            }} 
                          />
                        </label>
                        <input 
                          type="text"
                          className="flex-1 bg-[#0F0F0F] border border-[#1A1A1A] px-4 py-2 text-xs text-[#F5F5F3] focus:outline-none focus:border-[#C9A227]"
                          placeholder={uploadingReplyImage ? "Subiendo imagen adjunta..." : "Escribe una respuesta (o pega una captura con Ctrl+V)..."}
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          onPaste={(e) => handlePasteImage(e, setReplyImages, setUploadingReplyImage)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply()}
                        />
                        <button 
                          onClick={handleReply}
                          disabled={(!replyContent.trim() && replyImages.length === 0) || submitting || uploadingReplyImage}
                          className="bg-[#C9A227] text-[#080808] p-2 hover:bg-[#A8841D] transition-colors disabled:opacity-40"
                          title="Enviar respuesta"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })() : (
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
        <div 
          className="space-y-4 text-left"
          onPaste={(e) => handlePasteImage(e, setNewImages, setUploadingImage)}
        >
          <div>
            <label className={labelCls}>Título del Comentario</label>
            <input 
              className={inputCls} 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              placeholder="Ej. Rediseñar el encabezado de Casos" 
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

          <div>
            <label className={labelCls}>Capturas de pantalla o imágenes (Opcional)</label>
            <div className="border border-dashed border-[#1A1A1A] bg-[#080808] hover:border-[#C9A227]/50 p-4 transition-colors text-center">
              <input
                type="file"
                id="suggestion-img-input"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploadingImage}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setUploadingImage(true);
                    for (const file of files) {
                      const url = await uploadImageFile(file);
                      if (url) setNewImages(prev => [...prev, url]);
                    }
                    setUploadingImage(false);
                    e.target.value = "";
                  }
                }}
              />
              <label 
                htmlFor="suggestion-img-input" 
                className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
              >
                <div className="w-9 h-9 rounded-full bg-[#141414] border border-[#1A1A1A] flex items-center justify-center text-[#C9A227]">
                  {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                </div>
                <p className="text-xs text-[#F5F5F3]/80 font-medium">
                  {uploadingImage ? "Subiendo imagen(es)..." : "Haz clic para subir o pega una captura aquí (Ctrl + V)"}
                </p>
                <p className="text-[10px] text-[#F5F5F3]/30">
                  Formatos soportados: PNG, JPG, WEBP (hasta 10 MB). Ideal para señalar qué cambiar y en qué sección.
                </p>
              </label>

              {newImages.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#1A1A1A] flex flex-wrap gap-2.5 justify-start">
                  {newImages.map((url, index) => (
                    <div key={index} className="relative group w-20 h-20 border border-[#1A1A1A] bg-[#0F0F0F]">
                      <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewImages(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600 transition-colors"
                        title="Quitar imagen"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={handleCreate} 
            disabled={!newTitle.trim() || (!newContent.trim() && newImages.length === 0) || submitting || uploadingImage} 
            className="w-full bg-[#C9A227] text-[#080808] text-xs tracking-wider uppercase px-5 py-3 disabled:opacity-30 hover:bg-[#A8841D] transition-colors"
          >
            {submitting ? "Guardando…" : "Publicar Comentario"}
          </button>
        </div>
      </Modal>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[92vh] bg-[#080808] border border-[#1A1A1A] p-3 flex flex-col w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1A1A1A] text-xs text-[#F5F5F3]/60 mb-2">
              <span className="flex items-center gap-1.5 text-[#C9A227] font-medium">
                <ImageIcon size={14} /> Captura del Cambio
              </span>
              <div className="flex items-center gap-4">
                <a 
                  href={lightboxUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-[#C9A227] flex items-center gap-1 transition-colors text-[11px]"
                >
                  <ExternalLink size={12} /> Abrir original
                </a>
                <button 
                  onClick={() => setLightboxUrl(null)}
                  className="hover:text-red-400 p-1 text-[#F5F5F3]/60 transition-colors"
                  title="Cerrar visor"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-2 bg-[#050505]">
              <img 
                src={lightboxUrl} 
                alt="Captura ampliada" 
                className="max-w-full max-h-[80vh] object-contain select-none" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
