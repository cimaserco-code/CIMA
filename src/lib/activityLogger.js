import { supabase } from "./supabaseClient";

const LOCAL_STORAGE_KEY = "cima_activity_logs_cache";

function getLocalActivities() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalActivity(activity) {
  try {
    const list = getLocalActivities();
    list.unshift(activity);
    if (list.length > 300) list.length = 300;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("No se pudo guardar la actividad en caché local:", err);
  }
}

/**
 * Registra una acción de actividad en el historial.
 * Funciona guardando en Supabase (activity_logs o messages como canal de respaldo en la nube)
 * y en caché local persistente.
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

  const entry = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user_id: userId || null,
    user_name: userName || "Usuario",
    user_email: userEmail || null,
    action,
    module,
    description,
    metadata,
    created_at: new Date().toISOString()
  };

  // 1. Guardar siempre en caché local para disponibilidad inmediata
  saveLocalActivity(entry);

  // 2. Intentar guardar en Supabase activity_logs
  try {
    const { error: logErr } = await supabase.from("activity_logs").insert([{
      user_id: entry.user_id,
      user_name: entry.user_name,
      user_email: entry.user_email,
      action: entry.action,
      module: entry.module,
      description: entry.description,
      metadata: entry.metadata,
      created_at: entry.created_at
    }]);

    if (!logErr) return;
  } catch {
    // Si la tabla activity_logs no existe, pasamos al respaldo en messages
  }

  // 3. Respaldo en tabla messages (canal de sincronización en la nube compartido por todos los usuarios)
  try {
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
  } catch (err) {
    console.warn("Aviso al sincronizar actividad en la nube:", err);
  }
}

/**
 * Consulta todas las actividades registradas de todas las fuentes:
 * 1. Tabla `activity_logs` (si existe en Supabase)
 * 2. Tabla `messages` (canal de auditoría en la nube donde están todas las ediciones y eliminaciones de los usuarios)
 * 3. Documentos reales de Supabase (`documents`) para que ningún archivo subido falte
 * 4. Casos reales de Supabase (`cases`)
 * 5. Tareas reales de Supabase (`tasks`)
 * 6. Caché local de la sesión
 */
export async function fetchActivities() {
  const merged = [];
  const knownIds = new Set();
  let hasDbActivityLogs = false;

  // 1. Consultar tabla activity_logs
  try {
    const { data: logs, error: logErr } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!logErr && Array.isArray(logs) && logs.length > 0) {
      hasDbActivityLogs = true;
      logs.forEach(l => {
        merged.push(l);
        knownIds.add(l.id);
      });
    }
  } catch (err) {
    console.warn("No se pudo consultar activity_logs:", err);
  }

  // 2. Consultar tabla messages (auditoría en la nube: ediciones, eliminaciones y registros de usuarios)
  try {
    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!msgErr && Array.isArray(msgs)) {
      msgs
        .filter(m => m.attachments && m.attachments.is_activity_log)
        .forEach(m => {
          if (!knownIds.has(m.id)) {
            merged.push({
              id: m.id,
              user_id: m.sender_id,
              user_name: m.attachments.user_name || "Usuario",
              user_email: m.attachments.user_email || null,
              action: m.attachments.action || "EDITAR",
              module: m.attachments.module || "General",
              description: m.content,
              metadata: m.attachments.metadata || {},
              created_at: m.created_at
            });
            knownIds.add(m.id);
          }
        });
    }
  } catch (err) {
    console.warn("No se pudo consultar respaldo en messages:", err);
  }

  // 3. Consultar documentos directamente de Supabase (garantiza ver todos los documentos subidos)
  try {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, title, doc_type, lawyer, status, file_url, file_name, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (Array.isArray(docs)) {
      docs.forEach(doc => {
        // Verificar si ya existe en merged un log de creación/subida para este documento
        const alreadyLogged = merged.some(m =>
          (m.action === "SUBIR" || m.action === "CREAR") &&
          (m.metadata?.document_id === doc.id || (doc.title && m.description?.includes(doc.title)))
        );

        if (!alreadyLogged) {
          const isUploaded = !!doc.file_url;
          const displayTitle = doc.title || doc.file_name || "Documento";
          const fileInfo = doc.file_name ? ` (${doc.file_name})` : "";
          
          merged.push({
            id: `doc_${doc.id}`,
            user_id: null,
            user_name: doc.lawyer || "Equipo CIMA",
            user_email: doc.lawyer && doc.lawyer.includes("@") ? doc.lawyer : null,
            action: isUploaded ? "SUBIR" : "CREAR",
            module: "Documentos",
            description: isUploaded
              ? `Subió el documento "${displayTitle}"${fileInfo}`
              : `Registró el documento "${displayTitle}"`,
            metadata: {
              document_id: doc.id,
              file_name: doc.file_name,
              file_url: doc.file_url,
              doc_type: doc.doc_type,
              status: doc.status
            },
            created_at: doc.created_at || doc.updated_at || new Date().toISOString()
          });
        }
      });
    }
  } catch (err) {
    console.warn("No se pudieron obtener documentos para historial:", err);
  }

  // 4. Consultar casos de Supabase
  try {
    const { data: cases } = await supabase
      .from("cases")
      .select("id, title, case_number, client, status, assigned_lawyers, created_at")
      .order("created_at", { ascending: false });

    if (Array.isArray(cases)) {
      cases.forEach(c => {
        const alreadyLogged = merged.some(m =>
          m.metadata?.case_id === c.id || (c.title && m.description?.includes(c.title))
        );

        if (!alreadyLogged) {
          const lawyer = Array.isArray(c.assigned_lawyers) ? c.assigned_lawyers[0] : c.assigned_lawyers;
          merged.push({
            id: `case_${c.id}`,
            user_id: null,
            user_name: lawyer || "Equipo CIMA",
            user_email: lawyer && lawyer.includes("@") ? lawyer : null,
            action: "CREAR",
            module: "Casos",
            description: `Creó el expediente "${c.title}"${c.case_number ? ` (Exp. ${c.case_number})` : ""}${c.client ? ` para ${c.client}` : ""}`,
            metadata: {
              case_id: c.id,
              case_number: c.case_number,
              client: c.client
            },
            created_at: c.created_at || new Date().toISOString()
          });
        }
      });
    }
  } catch (err) {
    console.warn("No se pudieron obtener casos para historial:", err);
  }

  // 5. Consultar tareas de Supabase
  try {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, urgency, assigned_lawyer, created_at")
      .order("created_at", { ascending: false });

    if (Array.isArray(tasks)) {
      tasks.forEach(t => {
        const alreadyLogged = merged.some(m =>
          m.metadata?.task_id === t.id || (t.title && m.description?.includes(t.title))
        );

        if (!alreadyLogged) {
          merged.push({
            id: `task_${t.id}`,
            user_id: null,
            user_name: t.assigned_lawyer || "Equipo CIMA",
            user_email: t.assigned_lawyer && t.assigned_lawyer.includes("@") ? t.assigned_lawyer : null,
            action: "CREAR",
            module: "Tareas",
            description: `Asignó la tarea "${t.title}"${t.urgency ? ` [Prioridad: ${t.urgency}]` : ""}`,
            metadata: {
              task_id: t.id,
              urgency: t.urgency
            },
            created_at: t.created_at || new Date().toISOString()
          });
        }
      });
    }
  } catch (err) {
    console.warn("No se pudieron obtener tareas para historial:", err);
  }

  // 6. Agregar eventos locales de la sesión (deduplicando)
  const localActs = getLocalActivities();
  localActs.forEach(la => {
    if (!knownIds.has(la.id)) {
      const alreadyIn = merged.some(m =>
        m.id === la.id || 
        (m.description === la.description && Math.abs(new Date(m.created_at) - new Date(la.created_at)) < 5000)
      );
      if (!alreadyIn) {
        merged.push(la);
        knownIds.add(la.id);
      }
    }
  });

  // Ordenar cronológicamente descendente (más reciente primero)
  merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return {
    data: merged,
    source: hasDbActivityLogs ? "activity_logs" : "aggregated"
  };
}
