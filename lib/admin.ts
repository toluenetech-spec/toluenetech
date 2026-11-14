/**
 * Typed client for /admin/* endpoints.
 *
 * Auth (Phase 1):
 *   - On login, POST /auth/admin/login with password → receives a short-lived
 *     Bearer JWT. Stored in sessionStorage.tt_admin_token; the password is
 *     NOT persisted in the browser beyond the login request.
 *   - All subsequent requests send Authorization: Bearer <token>.
 *   - Legacy X-TT-Admin-Password header is still sent as a fallback during
 *     the transition (DEV_MODE may accept it). Production does not.
 *
 * Same Worker base URL as the public site (lib/api) — Cloudflare Worker in
 * production, Vite proxy (`''`) in dev.
 */
import { apiBase } from './api';
import { parseResponse } from './http';
import type { ChatMessage } from '../server/src/ai/types';

export type Json = Record<string, unknown>;
const BASE = () => apiBase();

const TOKEN_KEY = 'tt_admin_token';
const USER_KEY = 'tt_admin_user';
// Legacy password (kept only for DEV_MODE backward compatibility).
const LEGACY_KEY = 'tt_admin_session';

function getToken(): string {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function getLegacyPassword(): string {
  try { return sessionStorage.getItem(LEGACY_KEY) || ''; } catch { return ''; }
}
export function clearAdminSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
}
export function getAdminUser(): { email: string; name?: string; role?: string } | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function hasAdminSession(): boolean {
  return !!getToken() || !!getLegacyPassword();
}

export async function adminLogin(password: string): Promise<{ user: { email: string; name?: string; role?: string } }> {
  const res = await fetch(`${BASE()}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message || data?.error || `Login failed (${res.status})`);
  }
  const { token, user, expiresIn } = data.data;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    // Clean up legacy password storage now that we have a proper token.
    sessionStorage.removeItem(LEGACY_KEY);
    // Simple auto-clear on expiry.
    setTimeout(clearAdminSession, Math.max(60_000, (expiresIn - 60) * 1000));
  } catch { /* ignore storage errors */ }
  return { user };
}

export async function adminLogout() {
  const token = getToken();
  if (token) {
    try { await fetch(`${BASE()}/auth/admin/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch { /* ignore */ }
  }
  clearAdminSession();
}

async function http<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${BASE()}${path}`;
  const token = getToken();
  const legacy = getLegacyPassword();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (legacy && !token) headers['X-TT-Admin-Password'] = legacy;
  // Bridge the shared parseResponse 401 event into the legacy admin event so
  // AuthContext can clear session and redirect to login.
  const onExpired = () => {
    clearAdminSession();
    window?.dispatchEvent?.(new CustomEvent('tt:admin-unauthorized'));
  };
  window.addEventListener('tt:auth-expired', onExpired, { once: true });
  try {
    const res = await fetch(url, { ...opts, headers });
    return await parseResponse<T>(res);
  } finally {
    window.removeEventListener('tt:auth-expired', onExpired);
  }
}

export const api = {
  // Dashboard
  stats: () => http('/admin/stats'),

  // Auth helpers exposed for UI.
  login: adminLogin,
  logout: adminLogout,
  me: () => http('/auth/me'),
  user: getAdminUser,

  // Generic CRUD (returns the inner `data` or the legacy shape, depending on envelope)
  list: (entity: string, params?: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (params) for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const qs = q.toString();
    return http(`/admin/${entity}${qs ? '?'+qs : ''}`);
  },
  get: (entity: string, id: string) => http(`/admin/${entity}/${id}`),
  create: (entity: string, body: Json) => http(`/admin/${entity}`, { method: 'POST', body: JSON.stringify(body) }),
  update: (entity: string, id: string, body: Json) => http(`/admin/${entity}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (entity: string, id: string) => http(`/admin/${entity}/${id}`, { method: 'DELETE' }),

  // Settings
  settings: () => http('/admin/settings'),
  setSetting: (key: string, value: unknown) => http(`/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),

  // Leads: notes, status changes, conversion
  leadNotes: (id: string) => http(`/admin/leads/${id}/notes`),
  addLeadNote: (id: string, body: string, type = 'note') =>
    http(`/admin/leads/${id}/notes`, { method: 'POST', body: JSON.stringify({ body, type }) }),
  updateLeadStatus: (id: string, status: string, note?: string) =>
    http(`/admin/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  convertLead: (id: string, allowMerge = true) =>
    http(`/admin/leads/${id}/convert`, { method: 'POST', body: JSON.stringify({ allowMerge }) }),

  // Clients
  regenerateClientCode: (id: string) => http(`/admin/clients/${id}/regenerate-code`, { method: 'POST', body: JSON.stringify({}) }),

  // Client projects
  clientProjects: (clientId?: string) => http(`/admin/client-projects${clientId ? `?clientId=${clientId}` : ''}`),
  clientProject: (id: string) => http(`/admin/client-projects/${id}`),
  milestones: (projectId?: string) => http(`/admin/milestones${projectId ? `?projectId=${projectId}` : ''}`),
  tasks: (filters?: { projectId?: string; milestoneId?: string }) => {
    const q = new URLSearchParams();
    if (filters?.projectId) q.set('projectId', filters.projectId);
    if (filters?.milestoneId) q.set('milestoneId', filters.milestoneId);
    const qs = q.toString();
    return http(`/admin/tasks${qs ? '?' + qs : ''}`);
  },
  projectFiles: (projectId: string) => http(`/admin/projects/${projectId}/files`),
  uploadProjectFile: async (projectId: string, file: File, onProgress?: (pct: number) => void) => {
    const token = getToken();
    const legacy = getLegacyPassword();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (legacy && !token) headers['X-TT-Admin-Password'] = legacy;
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${BASE()}/admin/projects/${encodeURIComponent(projectId)}/files?filename=${encodeURIComponent(file.name)}`;
      xhr.open('POST', url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error('Invalid server response.')); }
        } else {
          let msg = `Upload failed (${xhr.status})`;
          try { const j = JSON.parse(xhr.responseText); msg = j?.error?.message || j?.error || msg; } catch { /* ignore */ }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(file);
    });
  },
  deleteProjectFile: (projectId: string, fileId: string) => http(`/admin/projects/${projectId}/files/${fileId}`, { method: 'DELETE' }),
  projectMessages: (projectId: string) => http(`/admin/projects/${projectId}/messages`),
  sendProjectMessage: (projectId: string, body: string, threadId?: string) =>
    http(`/admin/projects/${projectId}/messages`, { method: 'POST', body: JSON.stringify({ body, threadId }) }),
  markProjectMessagesRead: (projectId: string) => http(`/admin/projects/${projectId}/messages/read`, { method: 'POST' }),
  milestoneApprovals: (milestoneId: string) => http(`/admin/milestones/${milestoneId}/approvals`),
  invoices: (filters?: { clientId?: string; projectId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (filters?.clientId) q.set('clientId', filters.clientId);
    if (filters?.projectId) q.set('projectId', filters.projectId);
    if (filters?.status) q.set('status', filters.status);
    const qs = q.toString();
    return http(`/admin/invoices${qs ? '?' + qs : ''}`);
  },
  invoice: (id: string) => http(`/admin/invoices/${id}`),
  createInvoice: (body: any) => http('/admin/invoices', { method: 'POST', body: JSON.stringify(body) }),
  updateInvoice: (id: string, body: any) => http(`/admin/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  sendInvoice: (id: string) => http(`/admin/invoices/${id}/send`, { method: 'PUT' }),
  deleteInvoice: (id: string) => http(`/admin/invoices/${id}`, { method: 'DELETE' }),

  // Media
  media: () => http('/admin/media'),
  deleteMedia: (id: string) => http(`/admin/media/${id}`, { method: 'DELETE' }),
  uploadMedia: async (file: File, alt?: string) => {
    const token = getToken();
    const legacy = getLegacyPassword();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (legacy && !token) headers['X-TT-Admin-Password'] = legacy;
    const url = `${BASE()}/media/upload?filename=${encodeURIComponent(file.name)}${alt ? '&alt='+encodeURIComponent(alt) : ''}`;
    const res = await fetch(url, { method: 'POST', body: file, headers });
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('application/json')) {
      throw new Error(`Unexpected non-JSON response from media upload (${res.status})`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data?.error || `Upload failed ${res.status}`);
    return data.success ? data.data : data;
  },

  // AI
  aiConfig: () => http('/admin/ai/config'),
  aiModels: () => http('/admin/ai/models'),
  aiStatus: () => http('/admin/ai/status'),
  aiSaveConfig: (surfaces: Record<string, { primary: string; fallback: string | null; fallbackEnabled: boolean; timeoutMs?: number; maxTokens?: number; toolsEnabled?: string[] }>) =>
    http('/admin/ai/config', { method: 'POST', body: JSON.stringify({ surfaces }) }),
  aiConversations: (prefix?: string) => http(`/admin/ai/conversations${prefix ? `?prefix=${prefix}` : ''}`),
  aiConversation: (id: string) => http(`/admin/ai/conversations/${id}/messages`),
  aiRename: (id: string, name: string) => http(`/admin/ai/conversations/${id}/rename`, { method: 'POST', body: JSON.stringify({ name }) }),
  aiDelete: (id: string) => http(`/admin/ai/conversations/${id}`, { method: 'DELETE' }),

  // Admin chat
  async adminChat(message: string, anonId: string | null): Promise<{ reply: string; anonId: string; model: string; usedFallback: boolean; toolCalls: { name: string; ok: boolean }[]; error?: string }> {
    const token = getToken();
    const legacy = getLegacyPassword();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (legacy && !token) headers['X-TT-Admin-Password'] = legacy;
    const res = await fetch(`${BASE()}/assistant/admin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, anonId }),
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('application/json')) {
      throw new Error(`Unexpected non-JSON response from assistant/admin (${res.status})`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Chat failed ${res.status}`);
    return data;
  },
};

export { apiBase };
