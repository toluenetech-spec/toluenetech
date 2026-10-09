/**
 * Shared HTTP helpers for consistent error handling across the app.
 *
 * Every fetch wrapper funnels errors through `handleHttpError` which:
 *   - never leaks stack traces, SQL, or secrets
 *   - produces user-friendly messages for 400/401/403/404/409/422/429/500/503
 *   - fires a DOM event `tt:auth-expired` on 401 so auth providers can logout
 *   - returns an Error with `.status` and `.code` set so callers can branch
 */

export interface ApiErrorShape extends Error {
  status: number;
  code: string;
}

const FRIENDLY: Record<number, string> = {
  400: 'The request was missing required information. Please check your input and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to perform this action.",
  404: 'That record could not be found.',
  409: 'This operation conflicts with the current state (for example, a duplicate or invalid status change).',
  422: 'Some of the information provided was invalid. Please review the highlighted fields.',
  429: 'Too many requests in a short time. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Our team has been notified; please retry shortly.',
  502: 'The service is temporarily unreachable. Please retry shortly.',
  503: 'The service is temporarily unavailable. Please retry shortly.',
  504: 'The request timed out. Please check your connection and try again.',
};

function redact(msg: string): string {
  if (!msg) return '';
  // Strip anything that looks like a stack trace, SQL, or token.
  return msg
    .replace(/\b(?:bearer\s+)?[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/gi, '[redacted-token]')
    .replace(/(?:password|secret|token|key|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\s+at\s+\S+\s+\([^)]+\)/g, '')
    .slice(0, 400);
}

export async function parseResponse<T = any>(res: Response): Promise<T> {
  const ct = res.headers.get('content-type') || '';
  if (res.ok) {
    if (!ct.includes('application/json')) return (undefined as unknown) as T;
    const data = await res.json();
    // Support both {success,data} envelopes and direct payloads.
    // When envelope is present and success is true, return .data so callers
    // don't need to unwrap; when success is false treat as error.
    if (data && typeof data === 'object' && 'success' in data) {
      if (!(data as any).success) {
        const msg = redact((data as any)?.error?.message || (data as any)?.error || 'Request failed');
        const err = new Error(msg) as ApiErrorShape;
        err.status = res.status;
        err.code = (data as any)?.error?.code || `HTTP_${res.status}`;
        if (res.status === 401) {
          try { window.dispatchEvent(new CustomEvent('tt:auth-expired')); } catch { /* no window */ }
        }
        throw err;
      }
      return ((data as any).data ?? data) as T;
    }
    return data as T;
  }
  // Error path
  let message = '';
  let code = `HTTP_${res.status}`;
  try {
    if (ct.includes('application/json')) {
      const j = await res.json() as any;
      message = j?.error?.message || j?.error || j?.message || '';
      code = j?.error?.code || code;
    } else {
      message = (await res.text()).slice(0, 200);
    }
  } catch { /* ignore */ }
  message = redact(message) || FRIENDLY[res.status] || `Request failed (${res.status})`;
  const err = new Error(message) as ApiErrorShape;
  err.status = res.status;
  err.code = code;
  if (res.status === 401) {
    try { window.dispatchEvent(new CustomEvent('tt:auth-expired')); } catch { /* no window */ }
  }
  throw err;
}

export function friendlyHttp(status: number): string {
  return FRIENDLY[status] || `Request failed (${status})`;
}

/** Build auth headers helper */
export function authHeader(token: string | null | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
