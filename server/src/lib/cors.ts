import type { Context, Next } from 'hono';

/**
 * Allow Netlify + local dev origins. Reads CORS_ORIGIN env (comma-separated)
 * and reflects the request origin if it matches.
 */
export function cors(allowed: string) {
  const list = allowed.split(',').map(s => s.trim()).filter(Boolean);
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');
    const match = origin && list.some(o =>
      o === origin ||
      (o.includes('*') && new RegExp('^' + o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(origin))
    ) ? origin : undefined;
    if (match) {
      c.res.headers.set('Access-Control-Allow-Origin', match);
      c.res.headers.set('Vary', 'Origin');
      c.res.headers.set('Access-Control-Allow-Credentials', 'false');
      c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Anon-Id');
      c.res.headers.set('Access-Control-Max-Age', '86400');
    }
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: c.res.headers });
    }
    await next();
  };
}
