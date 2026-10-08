import React, { createContext, useContext, useState, useEffect } from 'react';
import { Client } from '../types';
import { apiBase } from '../lib/api';

/**
 * Client authentication (Phase 1 secure).
 *
 * Phase 1 rule: identity is ALWAYS established server-side. The browser no
 * longer trusts email+code from sessionStorage as proof of identity — the
 * portal exchanges credentials at POST /auth/client/login for a short-lived
 * Bearer JWT signed by the Worker. Only the JWT is sent on subsequent
 * requests; the clientId is taken from the token on the server (never from
 * request params/body).
 *
 * Portal pages still render from Firebase DataContext for now (Phase 2 will
 * switch them to /client/*), but login/logout/session use the real backend.
 */
interface ClientAuthContextType {
  client: Client | null;
  token: string | null;
  login: (email: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

const TOKEN_KEY = 'tt_client_token';
const USER_KEY = 'tt_client_user';

type ClientUser = { id: string; name: string; email: string; company?: string; status?: string };

export const ClientAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate from storage on mount. We don't verify JWT in the browser; the
    // server will reject expired tokens. We optimistically set client info
    // from stored user payload (if present).
    try {
      const t = sessionStorage.getItem(TOKEN_KEY);
      const u = sessionStorage.getItem(USER_KEY);
      if (t) {
        setToken(t);
        if (u) {
          const parsed: ClientUser = JSON.parse(u);
          setClient({ id: parsed.id, name: parsed.name, email: parsed.email, company: parsed.company ?? '', accessCode: '', status: parsed.status as any ?? 'ACTIVE' } as Client);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const login = async (email: string, code: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase()}/auth/client/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessCode: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) return false;
      const { token: t, client: c, expiresIn } = data.data;
      sessionStorage.setItem(TOKEN_KEY, t);
      sessionStorage.setItem(USER_KEY, JSON.stringify(c));
      setToken(t);
      setClient({ id: c.id, name: c.name, email: c.email, company: c.company ?? '', accessCode: '', status: (c.status || 'ACTIVE') as any } as Client);
      // Auto-logout on expiry.
      setTimeout(() => { logout(); }, Math.max(60_000, (expiresIn - 60) * 1000));
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    const t = token;
    if (t) {
      try { await fetch(`${apiBase()}/auth/client/logout`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }); } catch { /* ignore */ }
    }
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setClient(null);
  };

  return (
    <ClientAuthContext.Provider value={{ client, token, login, logout }}>
      {children}
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = () => {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
};

/** Helper: attach client Bearer token to fetch headers for /client/* calls. */
export function clientAuthHeaders(token: string | null, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
