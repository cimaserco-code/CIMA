import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Leer y parsear .env.local manualmente para no requerir dotenv
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: No existe el archivo .env.local en la raíz.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("\nError: Faltan variables en .env.local.");
  console.error("Asegúrate de agregar la variable SUPABASE_SERVICE_ROLE_KEY en tu .env.local");
  process.exit(1);
}

// Inicializar cliente admin
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = 'admintest@example.com';
  const password = 'password123';
  const fullName = 'Administrador CIMA';

  console.log(`\nConectando a Supabase en ${supabaseUrl}...`);
  
  try {
    // Probar primero si la base de datos responde
    console.log("Probando consulta a la base de datos pública...");
    const { data: dbData, error: dbError } = await supabase.from('profiles').select('count');
    if (dbError) {
      console.error("Fallo en la base de datos:", dbError.message);
    } else {
      console.log("Base de datos en línea y respondiendo.");
    }

    /*
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      throw listError;
    }

    const existingUser = usersData.users.find(u => u.email === email);
    if (existingUser) {
      console.log(`Usuario existente encontrado con ID: ${existingUser.id}. Eliminándolo para crear una versión limpia...`);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
      if (deleteError) throw deleteError;
    }
    */

    // 2. Crear el nuevo usuario (Bypassa el Rate Limit de email e IP de forma nativa)
    console.log(`Creando nuevo usuario ${email} (confirmado automáticamente)...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'Admin'
      }
    });

    if (createError) throw createError;

    // 3. Forzar rol Admin en public.profiles
    console.log("Asignando rol de Admin en la tabla pública de perfiles...");
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'Admin' })
      .eq('id', newUser.user.id);
      
    if (profileError) {
      console.warn("Advertencia al actualizar perfil público:", profileError.message);
    }

    console.log("\n==============================================");
    console.log("¡USUARIO ADMINISTRADOR CREADO CON ÉXITO!");
    console.log(`Correo:      ${email}`);
    console.log(`Contraseña:  ${password}`);
    console.log("==============================================");
    console.log("Ya puedes ir a http://localhost:5173/ e iniciar sesión.");
    
  } catch (error) {
    console.error("\nError durante el proceso:");
    console.error(error);
  }
}

main();
