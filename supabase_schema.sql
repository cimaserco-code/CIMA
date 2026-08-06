-- Esquema completo de Supabase para la aplicación CIMA Legal

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Perfiles de Usuario (vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Usuario' CHECK (role IN ('Admin', 'Usuario', 'Cliente')),
  birthday DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para crear perfil automáticamente al registrar usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Usuario')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Tabla de Miembros de Equipo
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Abogado',
  birthday DATE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Casos
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  practice_area TEXT CHECK (practice_area IN ('Litigio', 'Corporativo', 'M&A', 'Propiedad Intelectual', 'Regulatorio', 'Arbitraje', 'Fiscal', 'Laboral')),
  status TEXT DEFAULT 'activo' CHECK (status IN ('activo', 'en_proceso', 'en_espera', 'cerrado', 'archivado')),
  priority TEXT DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
  assigned_lawyers TEXT[] DEFAULT '{}',
  next_hearing DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Tareas
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL UNIQUE CHECK (role IN ('Admin', 'Usuario', 'Cliente')),
  can_manage_users BOOLEAN DEFAULT FALSE,
  can_create_cases BOOLEAN DEFAULT TRUE,
  can_edit_cases BOOLEAN DEFAULT TRUE,
  can_delete_cases BOOLEAN DEFAULT FALSE,
  can_view_all_cases BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar roles por defecto
INSERT INTO public.role_permissions (role, can_manage_users, can_create_cases, can_edit_cases, can_delete_cases, can_view_all_cases)
VALUES 
  ('Admin', TRUE, TRUE, TRUE, TRUE, TRUE),
  ('Usuario', FALSE, TRUE, TRUE, FALSE, FALSE),
  ('Cliente', FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role) DO NOTHING;

-- 9. Tabla de Mensajería
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Políticas de acceso permisivas para usuarios autenticados
CREATE POLICY "Permitir lectura y escritura a usuarios autenticados en profiles" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en team_members" ON public.team_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en cases" ON public.cases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en tasks" ON public.tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en documents" ON public.documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en calendar_events" ON public.calendar_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en role_permissions" ON public.role_permissions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acceso total en messages" ON public.messages FOR ALL USING (auth.role() = 'authenticated');

-- Configuración del Storage de Supabase para documentos
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Document Storage Access" ON storage.objects FOR ALL USING (bucket_id = 'documents');
