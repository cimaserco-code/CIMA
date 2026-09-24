import { supabase } from "./supabaseClient";

export const NOTIFICATION_TTL_MS = 5 * 60 * 1000;

const getExpirationDate = () => new Date(Date.now() - NOTIFICATION_TTL_MS).toISOString();

/**
 * Registra una notificación para un usuario o conjunto de usuarios.
 * Si la tabla `notifications` no existe aún en Supabase, guarda un respaldo en la tabla `messages`
 * para garantizar que ninguna notificación se pierda ni cause errores en la aplicación.
 */
export async function createNotification({
  recipientName, // Nombre del abogado o usuario asignado (ej: "Lic. Roberto Garza")
  recipientUserId, // ID del usuario si se conoce directamente
  recipientEmail, // Correo del usuario si se conoce
  type, // 'caso' | 'tarea' | 'documento' | 'evento'
  title,
  message,
  link, // '/casos', '/tareas', '/documentos', '/calendario'
  metadata = {}
}) {
  if (!recipientName && !recipientUserId && !recipientEmail) return;

  try {
    let targetUserId = recipientUserId || null;

    // Si no tenemos el userId directo, intentar resolverlo desde team_members o profiles
    if (!targetUserId) {
      if (recipientEmail) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", recipientEmail)
          .maybeSingle();
        if (prof?.id) targetUserId = prof.id;
      }

      if (!targetUserId && recipientName) {
        const { data: member } = await supabase
          .from("team_members")
          .select("user_id, email")
          .ilike("full_name", recipientName.trim())
          .maybeSingle();

        if (member?.user_id) {
          targetUserId = member.user_id;
        } else if (member?.email) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", member.email)
            .maybeSingle();
          if (prof?.id) targetUserId = prof.id;
        }
      }
    }

    const payload = {
      user_id: targetUserId,
      recipient_name: recipientName || "Usuario",
      recipient_email: recipientEmail || null,
      type: type || "general",
      title: title || "Nueva asignación",
      message: message || "",
      link: link || "/",
      read: false,
      metadata: metadata || {}
    };

    // 1. Intentar insertar en la tabla dedicada 'notifications'
    const { error: notifErr } = await supabase.from("notifications").insert([payload]);

    if (!notifErr) return;

    // 2. Si la tabla notifications no existe aún (error PGRST205 o mensaje 'relation does not exist'),
    // guardamos como respaldo en messages con flag is_notification para no bloquear al usuario
    if (notifErr.code === "PGRST205" || notifErr.message?.includes("not find") || notifErr.message?.includes("relation")) {
      await supabase.from("messages").insert([{
        sender_id: targetUserId,
        content: message,
        attachments: {
          is_notification: true,
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          target_user_id: targetUserId,
          type,
          title,
          link,
          read: false,
          metadata
        }
      }]);
    } else {
      console.warn("Aviso al guardar notificación en Supabase:", notifErr.message);
    }
  } catch (err) {
    console.warn("Excepción silenciosa en createNotification:", err);
  }
}

/**
 * Consulta las notificaciones dirigidas al usuario autenticado.
 */
export async function fetchUserNotifications({ userId, userEmail, userName }) {
  if (!userId && !userEmail && !userName) return [];

  try {
    // 1. Intentar consultar desde la tabla 'notifications'
    const expiresAfter = getExpirationDate();
    await supabase.from("notifications").delete().lt("created_at", expiresAfter);
    await supabase.from("messages").delete().lt("created_at", expiresAfter).filter("attachments->>is_notification", "eq", "true");
    let query = supabase.from("notifications").select("*").gte("created_at", expiresAfter);
    
    // Filtrar por ID de usuario si está disponible
    if (userId) {
      query = query.or(`user_id.eq.${userId},recipient_name.ilike.%${userName || ""}%,recipient_email.eq.${userEmail || ""}`);
    } else if (userEmail) {
      query = query.or(`recipient_email.eq.${userEmail},recipient_name.ilike.%${userName || ""}%`);
    }

    const { data: notifs, error: notifErr } = await query.order("created_at", { ascending: false }).limit(40);

    if (!notifErr && notifs) {
      return notifs;
    }

    // 2. Si no existe la tabla notifications, consultar respaldo en messages
    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);

    if (!msgErr && msgs) {
      const parsed = msgs
        .filter(m => m.attachments && m.attachments.is_notification)
        .filter(m => new Date(m.created_at).getTime() >= Date.now() - NOTIFICATION_TTL_MS)
        .filter(m => {
          const att = m.attachments;
          if (userId && att.target_user_id === userId) return true;
          if (userEmail && att.recipient_email === userEmail) return true;
          if (userName && att.recipient_name && att.recipient_name.toLowerCase().includes(userName.toLowerCase())) return true;
          return false;
        })
        .map(m => ({
          id: m.id,
          user_id: m.sender_id,
          recipient_name: m.attachments.recipient_name,
          type: m.attachments.type || "general",
          title: m.attachments.title || "Notificación",
          message: m.content,
          link: m.attachments.link || "/",
          read: !!m.attachments.read,
          created_at: m.created_at,
          _is_fallback: true
        }));
      return parsed;
    }

    return [];
  } catch (err) {
    console.error("Error al consultar notificaciones:", err);
    return [];
  }
}

/**
 * Marca una notificación como leída.
 */
export async function markNotificationAsRead(notificationId, isFallback = false) {
  if (!notificationId) return;
  try {
    if (isFallback) {
      // Para respaldo en messages
      const { data: msg } = await supabase.from("messages").select("attachments").eq("id", notificationId).single();
      if (msg?.attachments) {
        await supabase.from("messages").update({
          attachments: { ...msg.attachments, read: true }
        }).eq("id", notificationId);
      }
    } else {
      await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
    }
  } catch (err) {
    console.warn("Error al marcar notificación como leída:", err);
  }
}

/**
 * Marca todas las notificaciones del usuario como leídas.
 */
export async function markAllNotificationsAsRead(notifications = []) {
  if (!notifications || notifications.length === 0) return;
  try {
    const directIds = notifications.filter(n => !n._is_fallback && !n.read).map(n => n.id);
    const fallbackIds = notifications.filter(n => n._is_fallback && !n.read).map(n => n.id);

    if (directIds.length > 0) {
      await supabase.from("notifications").update({ read: true }).in("id", directIds);
    }

    for (const fId of fallbackIds) {
      await markNotificationAsRead(fId, true);
    }
  } catch (err) {
    console.warn("Error al marcar todas como leídas:", err);
  }
}

/**
 * Elimina una notificacion del almacenamiento correspondiente.
 */
export async function deleteNotification(notificationId, isFallback = false) {
  if (!notificationId) return false;

  try {
    const result = isFallback
      ? await supabase.from("messages").delete().eq("id", notificationId).select("id")
      : await supabase.from("notifications").delete().eq("id", notificationId).select("id");

    if (result.error) throw result.error;
    return Array.isArray(result.data) && result.data.some(row => row.id === notificationId);
  } catch (err) {
    console.warn("Error al eliminar notificación:", err);
    return false;
  }
}
