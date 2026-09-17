import React, { createContext, useContext, useState } from 'react';

type Role = 'admin' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  role: Role;
  login: (pass: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// NOTE: This is the existing admin password auth. It is intentionally NOT
// changed/weakened per the production-preservation requirements. For a
// hardened production setup this should be replaced with Firebase Auth with
// custom claims — out of scope for this incremental upgrade.
const ADMIN_PASSWORD = 'iloveesther221@@';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<Role>(null);

  const login = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setRole('admin');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>
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

