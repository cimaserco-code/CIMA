import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

const DEFAULT_PERMISSIONS = {
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
};

const ADMIN_PERMISSIONS = {
  can_manage_users: true,
  can_view_all_cases: true,
  can_view_cases: true,
  can_create_cases: true,
  can_edit_cases: true,
  can_delete_cases: true,
  can_view_tasks: true,
  can_create_tasks: true,
  can_edit_tasks: true,
  can_delete_tasks: true,
  can_view_documents: true,
  can_create_documents: true,
  can_edit_documents: true,
  can_delete_documents: true,
  can_view_fees: true,
  can_create_fees: true,
  can_edit_fees: true,
  can_delete_fees: true,
  can_view_clients: true,
  can_create_clients: true,
  can_edit_clients: true,
  can_delete_clients: true
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const profileRequestRef = useRef(0);
  const userRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleSession = async (session) => {
      if (!session?.user) {
        profileRequestRef.current += 1;
        userRef.current = null;
        profileRef.current = null;
        setUser(null);
        setProfile(null);
        setPermissions(DEFAULT_PERMISSIONS);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        return;
      }

      const isSameUser = userRef.current?.id === session.user.id;
      userRef.current = session.user;
      setUser(session.user);
      setIsAuthenticated(true);

      // Only show full loading spinner on initial boot or user switch, NOT on tab focus token refreshes
      if (!isSameUser || !profileRef.current) {
        setIsLoadingAuth(true);
      }

      const requestId = await fetchProfile(session.user.id);
      if (requestId !== profileRequestRef.current) return;
      setIsLoadingAuth(false);
    };

    // Cargar la sesión inicial; INITIAL_SESSION se ignora para evitar una segunda carga.
    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    // Escuchar cambios posteriores de sesión en Supabase.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') {
        handleSession(session);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    const requestId = ++profileRequestRef.current;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (requestId !== profileRequestRef.current) return;

      const nextPermissions = await fetchRolePermissions(data.role);
      if (requestId !== profileRequestRef.current) return requestId;

      setProfile(data);
      profileRef.current = data;
      setPermissions(nextPermissions);
      return requestId;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      if (requestId === profileRequestRef.current) {
        setProfile(null);
        profileRef.current = null;
        setPermissions(DEFAULT_PERMISSIONS);
      }
      return requestId;
    }
  };

  const fetchRolePermissions = async (role) => {
    if (!role) return DEFAULT_PERMISSIONS;
    const cleanRole = String(role).trim();
    if (cleanRole.toLowerCase() === 'admin' || cleanRole.toLowerCase() === 'direccion general') {
      return ADMIN_PERMISSIONS;
    }

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .ilike('role', cleanRole)
        .maybeSingle();

      return !error && data ? data : DEFAULT_PERMISSIONS;
    } catch (err) {
      console.error('Error fetching role permissions:', err);
      return DEFAULT_PERMISSIONS;
    }
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const register = async (email, password, fullName, role = 'Usuario') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setPermissions(DEFAULT_PERMISSIONS);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      permissions,
      isAuthenticated, 
      isLoadingAuth,
      login,
      register,
      logout,
      refreshProfile: () => user && fetchProfile(user.id)
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
