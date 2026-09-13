import React, { createContext, useContext, useState, useEffect } from 'react';
import { Client } from '../types';
import { useData } from './DataContext';

interface ClientAuthContextType {
  client: Client | null;
  login: (email: string, code: string) => boolean;
  logout: () => void;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'tt_client_session';

export const ClientAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { clients, verifyClientAccess } = useData();
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { email, code } = JSON.parse(stored);
        const c = verifyClientAccess(email, code);
        if (c) setClient(c);
      }
    } catch {/* ignore */}
  }, [clients, verifyClientAccess]);

  const login = (email: string, code: string) => {
    const c = verifyClientAccess(email, code);
    if (c) {
      setClient(c);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email, code }));
      return true;
    }
    return false;
  };

  const logout = () => {
    setClient(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ClientAuthContext.Provider value={{ client, login, logout }}>
      {children}
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = () => {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
};
