/**
 * API client for the Toluene Tech Worker.
 *
 * In local dev, Vite proxies /api → http://localhost:8787 (wrangler).
 * In production, hits the deployed Worker directly.
 */
const _env = (import.meta as unknown as {
  env?: { VITE_API_URL?: string; DEV?: boolean; PROD?: boolean };
}).env;
const API_BASE =
  _env?.VITE_API_URL ??
  (_env?.DEV
    ? ''
    : 'https://toluene-tech-api.toluenetech.workers.dev');

function anonId(): string | null {
  try { return localStorage.getItem('tt_anon_id'); } catch { return null; }
}
function setAnonId(v: string) {
  try { localStorage.setItem('tt_anon_id', v); } catch { /* ignore */ }
}

export interface ChatReply {
  reply: string;
  anonId?: string;
  providerMissing?: boolean;
}

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
    } catch { /* offline */ }
  }
  const res = await fetch(`${API_BASE}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(a ? { 'X-Anon-Id': a } : {}) },
    body: JSON.stringify({ message, anonId: a, name: opts.name ?? null, email: opts.email ?? null }),
    signal: opts.signal,
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Too many requests — please wait a moment.');
    const t = await res.text().catch(() => '');
    throw new Error(t ? t : `Server error (${res.status})`);
  }
  const data = await res.json() as ChatReply;
  if (data.anonId) setAnonId(data.anonId);
  return data;
}

/* ---------------- Leads ---------------- */
export interface LeadSubmission {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  services?: string[];
  requirements?: string;
  budget?: string;
  timeline?: string;
  source?: string;
}

export interface LeadResult { ok: true; ref: string; }

export async function submitLead(lead: LeadSubmission): Promise<LeadResult> {
  const res = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'website-form',
      ...lead,
    }),
  });
  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try { const j = await res.json() as { error?: string }; if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<LeadResult>;
}

/* ---------------- Media ---------------- */
export async function uploadMedia(
  file: File,
  opts?: { onProgress?: (pct: number) => void },
): Promise<{ ok: true; publicUrl: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/media/upload?filename=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts?.onProgress) opts.onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Invalid response')); }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try { const j = JSON.parse(xhr.responseText); if (j.error) msg = j.error; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

export function apiBase(): string { return API_BASE; }
