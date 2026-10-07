/**
 * Typed client for /admin/* endpoints.
 * Auth: sends X-TT-Admin-Password from sessionStorage (same as ToleshChat).
 */
import type { ChatMessage } from '../server/src/ai/types';

export type Json = Record<string, unknown>;
const BASE = (import.meta as any).env?.VITE_API_URL || '';

function adminPassword(): string {
  try { return sessionStorage.getItem('tt_admin_session') || ''; } catch { return ''; }
}

async function http<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-TT-Admin-Password': adminPassword(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) throw new Error('Unauthorized');
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  // Dashboard
  stats: () => http('/admin/stats'),

  // Generic CRUD
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

  // Client projects
  clientProjects: (clientId?: string) => http(`/admin/client-projects${clientId ? `?clientId=${clientId}` : ''}`),
  milestones: (projectId?: string) => http(`/admin/milestones${projectId ? `?projectId=${projectId}` : ''}`),

  // Media
  media: () => http('/admin/media'),
  deleteMedia: (id: string) => http(`/admin/media/${id}`, { method: 'DELETE' }),
  uploadMedia: async (file: File, alt?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    const url = `/media/upload?filename=${encodeURIComponent(file.name)}${alt ? '&alt='+encodeURIComponent(alt) : ''}`;
    const res = await fetch(`${BASE}${url}`, { method: 'POST', body: file, headers: { 'X-TT-Admin-Password': adminPassword() } });
    if (!res.ok) throw new Error(`Upload failed ${res.status}`);
    return res.json();
  },

  // AI
  aiConfig: () => http('/admin/ai/config'),
  aiModels: () => http('/admin/ai/models'),
  aiStatus: () => http('/admin/ai/status'),
  aiSaveConfig: (surfaces: Record<string, { primary: string; fallback: string | null; fallbackEnabled: boolean }>) =>
    http('/admin/ai/config', { method: 'POST', body: JSON.stringify({ surfaces }) }),
  aiConversations: (prefix?: string) => http(`/admin/ai/conversations${prefix ? `?prefix=${prefix}` : ''}`),
  aiConversation: (id: string) => http(`/admin/ai/conversations/${id}/messages`),
  aiRename: (id: string, name: string) => http(`/admin/ai/conversations/${id}/rename`, { method: 'POST', body: JSON.stringify({ name }) }),
  aiDelete: (id: string) => http(`/admin/ai/conversations/${id}`, { method: 'DELETE' }),

  // Admin chat (reuses existing /assistant/admin; same auth)
  async adminChat(message: string, anonId: string | null): Promise<{ reply: string; anonId: string; model: string; usedFallback: boolean; toolCalls: { name: string; ok: boolean }[]; error?: string }> {
    const res = await fetch(`${BASE}/assistant/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TT-Admin-Password': adminPassword() },
      body: JSON.stringify({ message, anonId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Chat failed ${res.status}`);
    return data;
  },
};
