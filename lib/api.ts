/**
 * API client — all calls to the Cloudflare Worker.
 * In local dev it talks to wrangler on :8787; in production it uses the
 * relative path /api (proxied by Netlify/Vite) or VITE_API_URL.
 */
// Use relative /api in production (proxied to the Worker); localhost:8787 in dev.
const _env = (import.meta as unknown as { env?: { VITE_API_URL?: string; DEV?: boolean } }).env;
const API_BASE = _env?.VITE_API_URL ?? (_env?.DEV ? 'http://localhost:8787' : '/api');

function anonId(): string | null {
  try { return localStorage.getItem('tt_anon_id'); } catch { return null; }
}
function setAnonId(v: string) {
  try { localStorage.setItem('tt_anon_id', v); } catch { /* ignore */ }
}

export interface ChatReply { reply: string; anonId?: string; providerMissing?: boolean; }

export async function sendChatMessage(
  message: string,
  opts: { name?: string; email?: string; signal?: AbortSignal } = {},
): Promise<ChatReply> {
  let a = anonId();
  if (!a) {
    try {
      const r = await fetch(`${API_BASE}/assistant/session`, { signal: opts.signal });
      if (r.ok) {
        const s = await r.json() as { anonId: string };
        a = s.anonId;
        if (a) setAnonId(a);
      }
    } catch { /* offline — proceed without */ }
  }
  const res = await fetch(`${API_BASE}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(a ? { 'X-Anon-Id': a } : {}) },
    body: JSON.stringify({ message, anonId: a, name: opts.name ?? null, email: opts.email ?? null }),
    signal: opts.signal,
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Too many requests — please wait a moment.');
    throw new Error(`Server error (${res.status})`);
  }
  const data = await res.json() as ChatReply;
  if (data.anonId) setAnonId(data.anonId);
  return data;
}

export function apiBase(): string { return API_BASE; }
