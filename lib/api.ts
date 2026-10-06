/**
 * API client — all calls to the Cloudflare Worker.
 * In local dev it talks to wrangler on :8787; in production it uses the
 * relative path /api (proxied by Netlify/Vite) or VITE_API_URL.
 */
// In local dev we hit the Wrangler proxy (vite.config.ts proxies /api -> :8787).
// In production (Netlify/Cloudflare Pages) we hit the deployed Worker directly.
// Override by setting VITE_API_URL in your build env.
const _env = (import.meta as unknown as { env?: { VITE_API_URL?: string; DEV?: boolean; PROD?: boolean } }).env;
const API_BASE = _env?.VITE_API_URL
  ?? (_env?.DEV ? '' : 'https://toluene-tech-api.toluenetech.workers.dev');

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
