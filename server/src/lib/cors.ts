import type { Context, Next } from 'hono';

/**
 * CORS — permissive but origin-checked. Handles preflight (OPTIONS) immediately
 * and applies post-response headers for every other method.
 */
export function cors(allowed: string) {
  const list = allowed.split(',').map(s => s.trim()).filter(Boolean);

  function matchOrigin(origin: string): string | null {
    if (!origin) return null;
    for (const o of list) {
      if (o === origin) return origin;
      if (!o.includes('*')) continue;
      const escaped = o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      if (new RegExp('^' + escaped + '$').test(origin)) return origin;
    }
    return null;
  }

  function apply(c: Context, origin: string) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
    c.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-Anon-Id, Authorization, X-TT-Admin-Password, X-TT-Client-Email, X-TT-Client-Code, X-TT-Client-Demo');
    c.header('Access-Control-Max-Age', '86400');
  }

  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin') ?? '';
    const matched = matchOrigin(origin);
    if (c.req.method === 'OPTIONS') {
      if (matched) apply(c, matched);
      return new Response(null, { status: 204, headers: c.res.headers });
    }
    await next();
    if (matched) apply(c, matched);
  };
}
