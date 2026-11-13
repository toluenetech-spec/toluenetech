import type { Context, Next } from 'hono';

/**
 * CORS — origin-checked. Strict by default.
 *
 * Permitted origins come from env.CORS_ORIGIN (comma-separated). Wildcards
 * ('*.netlify.app', 'http://localhost:*') are supported for previews/dev but
 * in production the list should pin to the exact custom domain(s).
 *
 * We do NOT send Access-Control-Allow-Credentials because:
 *   - Session token is sent in Authorization header (not cookies).
 *   - Password header is a custom header — not a credential.
 * This avoids CSRF risk: browsers don't auto-send custom headers on cross-
 * origin simple/non-preflighted requests.
 */

const DEFAULT_PROD = 'https://toluenetech.com,https://www.toluenetech.com';
const DEFAULT_DEV = 'http://localhost:5173,http://127.0.0.1:5173';

export function resolveAllowedOrigins(allowed?: string, isDev = false): string[] {
  const raw = allowed ?? (isDev ? `${DEFAULT_PROD},${DEFAULT_DEV}` : DEFAULT_PROD);
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function matchOrigin(origin: string, list: string[]): string | null {
  if (!origin) return null;
  for (const o of list) {
    if (o === origin) return origin;
    if (!o.includes('*')) continue;
    const escaped = o.replace(/[.+?^${}()|[\\]\\\\]/g, '\\$&').replace(/\*/g, '.*');
    if (new RegExp('^' + escaped + '$').test(origin)) return origin;
  }
  return null;
}

export function cors(allowedList: string[]) {
  const allowedHeaders = [
    'Content-Type',
    'X-Anon-Id',
    'Authorization',
    'X-TT-Admin-Password',
    'X-TT-Client-Email',
    'X-TT-Client-Code',
    'X-TT-Client-Demo',
    'X-Request-Id',
  ].join(', ');
  const exposeHeaders = ['X-Request-Id', 'X-RateLimit-RetryAfter'].join(', ');

  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin') ?? '';
    const matched = matchOrigin(origin, allowedList);

    if (c.req.method === 'OPTIONS') {
      if (!matched) return new Response(null, { status: 204 });
      c.header('Access-Control-Allow-Origin', matched);
      c.header('Vary', 'Origin');
      c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      c.header('Access-Control-Allow-Headers', allowedHeaders);
      c.header('Access-Control-Max-Age', '86400');
      return new Response(null, { status: 204, headers: c.res.headers });
    }

    await next();

    if (matched) {
      c.header('Access-Control-Allow-Origin', matched);
      c.header('Vary', 'Origin');
      c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      c.header('Access-Control-Allow-Headers', allowedHeaders);
      c.header('Access-Control-Expose-Headers', exposeHeaders);
    }
  };
}

export { resolveAllowedOrigins as _internalResolveOrigins };
