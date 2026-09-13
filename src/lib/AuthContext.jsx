import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

/** Merge auth.users session user with public.profiles row (same shape pages expect). */
async function loadMergedUser(sessionUser) {
  if (!sessionUser) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, role, app_role, tenant_id, assigned_cooperativa_ids, interface_language, estado'
    )
    .eq('id', sessionUser.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to load profile:', error);
  }

  return {
    id: sessionUser.id,
    email: profile?.email || sessionUser.email || null,
    full_name: profile?.full_name || sessionUser.user_metadata?.full_name || null,
    role: profile?.role ?? 'user',
    app_role: profile?.app_role ?? null,
    tenant_id: profile?.tenant_id ?? null,
    assigned_cooperativa_ids: profile?.assigned_cooperativa_ids ?? [],
    interface_language: profile?.interface_language ?? 'es',
    estado: profile?.estado ?? 'activo',
  };
}

function clearLegacyBase44Tokens() {
  try {
    window.localStorage.removeItem('base44_access_token');
    window.localStorage.removeItem('token');
  } catch {
    /* ignore */
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Stub: Base44 app.getPublicSettings is gone; keep shape for App.jsx gate.
  const [appPublicSettings, setAppPublicSettings] = useState({
    id: 'urbalex',
    public_settings: {},
  });
  const bootstrapped = useRef(false);

  const applySession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      return null;
    }
    try {
      const merged = await loadMergedUser(session.user);
      setUser(merged);
      setIsAuthenticated(true);
      setAuthError(null);
      return merged;
    } catch (err) {
      console.error('Session apply failed:', err);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: 'Authentication required',
      });
      return null;
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        await applySession(data.session);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: 'Authentication required',
      });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [applySession]);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
    return applySession(data.session);
  }, [applySession]);

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      // No Base44 public settings; resolve immediately so App.jsx unblocks.
      setAppPublicSettings({ id: 'urbalex', public_settings: {} });
      await checkUserAuth();
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    checkAppState();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      // INITIAL_SESSION is covered by checkAppState; still sync later events.
      if (event === 'INITIAL_SESSION') return;
      setIsLoadingAuth(true);
      try {
        if (session) {
          await applySession(session);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, [checkAppState, applySession]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    clearLegacyBase44Tokens();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Supabase signOut failed:', e);
    }
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    const path = window.location.pathname + window.location.search;
    const returnTo =
      path && path !== '/login' && path !== '/register'
        ? `?returnTo=${encodeURIComponent(path)}`
        : '';
    window.location.href = `/login${returnTo}`;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
        refreshUser,
      }}
    >
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
