import { supabase } from "./supabaseClient";

/**
 * Registra una acción de actividad en el historial.
 * Funciona con la tabla `activity_logs` y cuenta con respaldo automático.
 */
export async function logActivity({
  userId,
  userName,
  userEmail,
  action, // 'CREAR' | 'EDITAR' | 'ELIMINAR' | 'SUBIR'
  module, // 'Documentos' | 'Casos' | 'Tareas' | 'Calendario' | 'Clientes' | 'Honorarios'
  description,
  metadata = {}
}) {
  if (!action || !module || !description) return;

  const payload = {
    user_id: userId || null,
    user_name: userName || "Usuario",
    user_email: userEmail || null,
    action,
    module,
    description,
    metadata
  };

  try {
    // 1. Intentar registrar en activity_logs
    const { error: logErr } = await supabase.from("activity_logs").insert([payload]);
    
    if (!logErr) return;

    // 2. Si la tabla activity_logs aún no ha sido creada en Supabase (error PGRST205),
    // guardamos de respaldo en la tabla messages para no perder ningún evento.
    if (logErr.code === "PGRST205" || logErr.message?.includes("not find")) {
      await supabase.from("messages").insert([{
        sender_id: userId || null,
        content: description,
        attachments: {
          is_activity_log: true,
          user_name: userName || "Usuario",
          user_email: userEmail || null,
          action,
          module,
          metadata
        }
      }]);
    } else {
      console.warn("Error al registrar actividad:", logErr.message);
    }
  } catch (err) {
    console.warn("Excepción al registrar actividad:", err);
  }
}

/**
 * Consulta todas las actividades registradas ordenadas cronológicamente.
 */
export async function fetchActivities() {
  try {
    // 1. Probar consultar de activity_logs
    const { data: logs, error: logErr } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!logErr && logs) {
      return { data: logs, source: "activity_logs" };
    }

    // 2. Si no existe la tabla, consultar respaldo en messages
    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!msgErr && msgs) {
      const parsed = msgs
        .filter(m => m.attachments && m.attachments.is_activity_log)
        .map(m => ({
          id: m.id,
          user_id: m.sender_id,
          user_name: m.attachments.user_name || "Usuario",
          user_email: m.attachments.user_email || null,
          action: m.attachments.action || "ACTUALIZAR",
          module: m.attachments.module || "General",
          description: m.content,
          metadata: m.attachments.metadata || {},
          created_at: m.created_at
        }));
      return { data: parsed, source: "messages_fallback" };
    }

    return { data: [], source: "none" };
  } catch (err) {
    console.error("Error al consultar actividades:", err);
    return { data: [], source: "error" };
  }
}
