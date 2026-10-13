/**
 * Very small in-memory rate limiter (per Worker isolate).
 */
interface Bucket { hits: number[]; }
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: { windowMs: number; max: number }): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter(t => now - t < opts.windowMs);
  if (b.hits.length >= opts.max) {
    const oldest = b.hits[0];
    return { ok: false, retryAfter: Math.max(0, Math.ceil((opts.windowMs - (now - oldest)) / 1000)) };
  }
  b.hits.push(now);
  buckets.set(key, b);
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  return (req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown').slice(0, 64);
}
