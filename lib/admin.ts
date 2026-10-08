/**
 * Typed client for /admin/* endpoints.
 * Auth: sends X-TT-Admin-Password from sessionStorage (same as ToleshChat).
 * Uses the same Worker base URL as the public site (lib/api) so admin requests
 * go to the Cloudflare Worker in production and to the Vite proxy (`''`) in
 * dev — never to Netlify, which would otherwise serve index.html as a 200.
 */
import { apiBase } from './api';
import type { ChatMessage } from '../server/src/ai/types';

export type Json = Record<string, unknown>;
const BASE = () => apiBase();

function adminPassword(): string {
  try { return sessionStorage.getItem('tt_admin_session') || ''; } catch { return ''; }
}

async function http<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${BASE()}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-TT-Admin-Password': adminPassword(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) throw new Error('Unauthorized');
  const ct = res.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    // Unexpected body (e.g. Netlify's SPA index.html, Worker 502 page) — don't
    // let HTML be parsed as "data" and crash downstream consumers.
    const snippet = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`Unexpected non-JSON response from ${path} (${res.status} ${res.statusText}${snippet ? ': ' + snippet.replace(/\s+/g, ' ') : ''})`);
  }
  let data: any = null;
  try { data = await res.json(); } catch (e) {
    throw new Error(`Invalid JSON response from ${path}: ${(e as Error).message}`);
  }
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
    const url = `${BASE()}/media/upload?filename=${encodeURIComponent(file.name)}${alt ? '&alt='+encodeURIComponent(alt) : ''}`;
    const res = await fetch(url, { method: 'POST', body: file, headers: { 'X-TT-Admin-Password': adminPassword() } });
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('application/json')) {
      throw new Error(`Unexpected non-JSON response from media upload (${res.status})`);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Upload failed ${res.status}`);
    }
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
    const res = await fetch(`${BASE()}/assistant/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TT-Admin-Password': adminPassword() },
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
