import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, adminLogin, adminLogout, clearAdminSession, hasAdminSession, getAdminUser } from '../lib/admin';

type Role = 'admin' | null;

interface User { email: string; name?: string; role?: string }

interface AuthContextType {
  isAuthenticated: boolean;
  role: Role;
  user: User | null;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => hasAdminSession());
  const [user, setUser] = useState<User | null>(() => getAdminUser());
  const [role, setRole] = useState<Role>(() => (hasAdminSession() ? 'admin' : null));

  useEffect(() => {
    // If we have a token (or legacy password) on mount but no user record, try
    // to hydrate from /auth/me. Legacy password sessions won't have a token but
    // may still work in dev; we still try to hydrate if possible.
    if (isAuthenticated && !user) {
      api.me().then((me: any) => {
        if (me?.kind === 'admin') {
          const u = { email: me.email, name: me.name, role: me.role };
          setUser(u);
          try { sessionStorage.setItem('tt_admin_user', JSON.stringify(u)); } catch { /* ignore */ }
        }
      }).catch(() => { /* session may already be invalid */ });
    }
    // Listen for unauthorized events from the API client.
    const onUnauth = () => {
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
    };
    window.addEventListener('tt:admin-unauthorized', onUnauth);
    return () => window.removeEventListener('tt:admin-unauthorized', onUnauth);
  }, [isAuthenticated, user]);

  const login = async (password: string): Promise<boolean> => {
    try {
      const res = await adminLogin(password);
      setUser(res.user);
      setIsAuthenticated(true);
      setRole('admin');
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try { await adminLogout(); } catch { /* ignore */ }
    clearAdminSession();
    setIsAuthenticated(false);
    setUser(null);
    setRole(null);
  };

  const refresh = () => {
    setIsAuthenticated(hasAdminSession());
    setUser(getAdminUser());
    setRole(hasAdminSession() ? 'admin' : null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, user, login, logout, refresh }}>
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
