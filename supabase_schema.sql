-- Esquema completo de Supabase para la aplicación CIMA Legal

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Limpiar tablas previas para evitar conflictos de referencias
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.suggestion_replies CASCADE;
DROP TABLE IF EXISTS public.suggestions CASCADE;
DROP TABLE IF EXISTS public.fees CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.cases CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.areas CASCADE;

-- 1.5 Tabla de Áreas
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Perfiles de Usuario (vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Usuario' CHECK (role IN ('Admin', 'Usuario', 'Cliente', 'Direccion General', 'Direccion de Area')),
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para crear perfil automáticamente al registrar usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Eliminar cualquier perfil huérfano con el mismo correo antes de insertar
  DELETE FROM public.profiles WHERE email = NEW.email;

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Usuario')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para sincronizar perfiles con la lista de miembros de equipo automáticamente
CREATE OR REPLACE FUNCTION public.sync_profile_to_team_members()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'Cliente' THEN
    -- Si es Cliente, lo eliminamos de la lista de equipo
    DELETE FROM public.team_members WHERE user_id = NEW.id;
  ELSE
    -- Para cualquier otro rol, lo insertamos o actualizamos en team_members
    INSERT INTO public.team_members (full_name, email, user_id, role, bio, area_id)
    VALUES (NEW.full_name, NEW.email, NEW.id, NEW.role, NEW.bio, NEW.area_id)
    ON CONFLICT (email) DO UPDATE 
    SET full_name = EXCLUDED.full_name, 
        user_id = EXCLUDED.user_id,
        role = EXCLUDED.role,
        bio = EXCLUDED.bio,
        area_id = EXCLUDED.area_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_changed
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_team_members();

-- 3. Tabla de Miembros de Equipo
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Abogado',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  bio TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 Tabla de Clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Casos
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  practice_area TEXT CHECK (practice_area IN ('Litigio', 'Corporativo', 'M&A', 'Propiedad Intelectual', 'Regulatorio', 'Arbitraje', 'Fiscal', 'Laboral')),
  status TEXT DEFAULT 'activo' CHECK (status IN ('activo', 'en_proceso', 'en_espera', 'cerrado', 'archivado')),
  priority TEXT DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
  assigned_lawyers TEXT[] DEFAULT '{}',
  next_hearing DATE,
  description TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Tareas
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  urgency TEXT DEFAULT 'media' CHECK (urgency IN ('urgente', 'alta', 'media', 'baja')),
  due_date DATE,
  task_type TEXT,
  assigned_lawyer TEXT,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'completada', 'cancelada')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de Documentos
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  doc_type TEXT CHECK (doc_type IN ('contrato', 'demanda', 'evidencia', 'escrito', 'otro')),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer TEXT,
  status TEXT DEFAULT 'borrador' CHECK (status IN ('borrador', 'editado', 'finalizado')),
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabla de Eventos del Calendario
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  event_type TEXT DEFAULT 'audiencia',
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  assigned_lawyers TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabla de Permisos por Rol
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL UNIQUE,
  can_manage_users BOOLEAN DEFAULT FALSE,
  can_view_all_cases BOOLEAN DEFAULT FALSE,
  
  -- Casos
  can_view_cases BOOLEAN DEFAULT TRUE,
  can_create_cases BOOLEAN DEFAULT TRUE,
  can_edit_cases BOOLEAN DEFAULT TRUE,
  can_delete_cases BOOLEAN DEFAULT FALSE,
  
  -- Tareas
  can_view_tasks BOOLEAN DEFAULT TRUE,
  can_create_tasks BOOLEAN DEFAULT TRUE,
  can_edit_tasks BOOLEAN DEFAULT TRUE,
  can_delete_tasks BOOLEAN DEFAULT FALSE,
  
  -- Documentos
  can_view_documents BOOLEAN DEFAULT TRUE,
  can_create_documents BOOLEAN DEFAULT TRUE,
  can_edit_documents BOOLEAN DEFAULT TRUE,
  can_delete_documents BOOLEAN DEFAULT FALSE,
  
  -- Honorarios
  can_view_fees BOOLEAN DEFAULT TRUE,
  can_create_fees BOOLEAN DEFAULT TRUE,
  can_edit_fees BOOLEAN DEFAULT TRUE,
  can_delete_fees BOOLEAN DEFAULT FALSE,
  
  -- Clientes
  can_view_clients BOOLEAN DEFAULT TRUE,
  can_create_clients BOOLEAN DEFAULT TRUE,
  can_edit_clients BOOLEAN DEFAULT TRUE,
  can_delete_clients BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar roles por defecto con la nueva matriz completa de permisos
INSERT INTO public.role_permissions (
  role, can_manage_users, can_view_all_cases,
  can_view_cases, can_create_cases, can_edit_cases, can_delete_cases,
  can_view_tasks, can_create_tasks, can_edit_tasks, can_delete_tasks,
  can_view_documents, can_create_documents, can_edit_documents, can_delete_documents,
  can_view_fees, can_create_fees, can_edit_fees, can_delete_fees,
  can_view_clients, can_create_clients, can_edit_clients, can_delete_clients
)
VALUES 
  -- Admin y Dirección General tienen control absoluto sobre todo
  ('Admin', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
  ('Direccion General', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
  
  -- Dirección de Área y Usuarios tienen permisos estándar (crear/editar, no borrar globalmente, filtrado por área activo)
  ('Direccion de Area', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE),
  ('Usuario', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE),
  
  -- Clientes no tienen permisos de edición directa de nada, solo lectura implícita (si la app les da acceso)
  ('Cliente', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role) DO NOTHING;

-- 8.5 Tabla de Honorarios
CREATE TABLE IF NOT EXISTS public.fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('pendiente', 'pagado', 'cancelado')) DEFAULT 'pendiente',
  due_date DATE,
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabla de Mensajería
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Habilitar RLS (Row Level Security) en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso permisivas para usuarios autenticados
CREATE POLICY "Permitir lectura y escritura a usuarios autenticados en profiles" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en team_members" ON public.team_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en cases" ON public.cases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en tasks" ON public.tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en documents" ON public.documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en calendar_events" ON public.calendar_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en role_permissions" ON public.role_permissions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en messages" ON public.messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en areas" ON public.areas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en fees" ON public.fees FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en clients" ON public.clients FOR ALL USING (auth.role() = 'authenticated');

-- 11. Tablas de Sugerencias y Foro
CREATE TABLE IF NOT EXISTS public.suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'sugerencia' CHECK (category IN ('sugerencia', 'cambio', 'error', 'otro')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.suggestion_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suggestion_id UUID REFERENCES public.suggestions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total en suggestions" ON public.suggestions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en replies" ON public.suggestion_replies FOR ALL USING (auth.role() = 'authenticated');

-- Configuración del Storage de Supabase para documentos
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Document Storage Access" ON storage.objects FOR ALL USING (bucket_id = 'documents');
