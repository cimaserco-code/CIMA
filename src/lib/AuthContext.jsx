import React, { createContext, useState, useContext, useEffect } from 'react';
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // Escuchar cambios de sesión en Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        setIsAuthenticated(true);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setPermissions(DEFAULT_PERMISSIONS);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
    });

    // Cargar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setIsAuthenticated(true);
        fetchProfile(session.user.id);
      }
      setIsLoadingAuth(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
        await fetchRolePermissions(data.role);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchRolePermissions = async (role) => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', role)
        .single();

      if (!error && data) {
        setPermissions(data);
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } catch (err) {
      console.error('Error fetching role permissions:', err);
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
