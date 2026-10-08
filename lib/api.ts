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
    let msg = `Server error (${res.status})`;
    try { const j = await res.json() as any; msg = j?.error?.message || j?.error || msg; } catch { const t = await res.text().catch(() => ''); if (t) msg = t.slice(0, 200); }
    throw new Error(msg);
  }
  const raw = await res.json();
  const data: ChatReply = (raw && typeof raw === 'object' && 'success' in raw && (raw as any).success) ? (raw as any).data : raw;
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
  sourcePage?: string;
  aiRef?: string;
  honeypot?: string;
}

export interface LeadResult { ok: true; ref: string; deduped?: boolean; }

export async function submitLead(lead: LeadSubmission): Promise<LeadResult> {
  const res = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({
      source: lead.source || 'website-form',
      sourcePage: lead.sourcePage || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      ...lead,
    }),
  });
  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try { const j = await res.json() as any; msg = j?.error?.message || j?.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const raw = await res.json();
  // Support both {ok,ref} and {success,data:{ref}} envelopes.
  if (raw && typeof raw === 'object' && 'success' in raw && (raw as any).success) {
    const d = (raw as any).data;
    return { ok: true, ref: d?.ref ?? d?.id };
  }
  return raw as LeadResult;
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
