# CIMA - Sistema de Gestión Legal

Aplicación web para gestión legal y de despacho de abogados construida con **React (Vite)**, **Supabase** y preparada para despliegue en **Vercel**.

## 🚀 Módulos del Sistema

- **Dashboard**: Resumen de casos activos, tareas pendientes, próximos eventos del calendario y métricas clave.
- **Casos**: Creación y gestión de expediente legal, cliente, nivel de prioridad, estado, área de práctica y asignación de abogados.
- **Tareas**: Tablero de tareas por estados (Por hacer, En progreso, Completada) con urgencia y seguimiento.
- **Documentos**: Gestión de contratos, demandas y evidencia, integración con **Supabase Storage** para subir y descargar archivos.
- **Calendario**: Vista mensual y en lista de audiencias, reuniones, vencimientos y cumpleaños del equipo.
- **Equipo**: Directorio de abogados y personal de la firma.
- **Administración**: Gestión de roles (Admin, Usuario, Cliente) y matriz de permisos por rol.

---

## 🛠️ Requisitos Previos

- **Node.js**: v18 o superior.
- **Supabase**: Un proyecto creado en [Supabase](https://supabase.com/).

---

## ⚙️ Configuración Inicial

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar el Esquema de Base de Datos en Supabase:**
   - Ve al **SQL Editor** en tu panel de Supabase.
   - Copia y ejecuta el contenido del archivo `supabase_schema.sql` ubicado en la raíz del proyecto.
   - Esto creará todas las tablas (`profiles`, `cases`, `tasks`, `documents`, `calendar_events`, `team_members`, `role_permissions`, `messages`), las políticas de seguridad (RLS) y el bucket de Storage para los documentos.

3. **Variables de Entorno:**
   - Copia el archivo `.env.example` a `.env.local`:
     ```bash
     cp .env.example .env.local
     ```
   - Agrega la URL y la Anon Key de tu proyecto de Supabase en `.env.local`:
     ```env
     VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
     VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
     ```

---

## 💻 Desarrollo Local

Para iniciar el servidor de desarrollo local:

```bash
npm run dev
```

Abre en tu navegador la URL proporcionada por Vite (normalmente `http://localhost:5173`).

---

## 📦 Compilación para Producción

Para validar o generar el build optimizado de producción:

```bash
npm run build
```

---

## 🌐 Despliegue en Vercel

1. Importa este repositorio en **Vercel**.
2. En la sección **Environment Variables** de Vercel, agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Vercel detectará la configuración automáticamente mediante el archivo `vercel.json` y desplegará la aplicación.
