/**
 * Lightweight analytics (privacy-friendly).
 *
 * POST /analytics/pv   — record a page view.
 *   Body: { path, referrer?, sessionId?, anonId?, utmSource?, utmMedium?, utmCampaign? }
 *   - No cookies set by the server.
 *   - No PII (IP is hashed before storage).
 *   - User-agent is hashed (sha-256 prefix) for rough dedup.
 *
 * GET  /admin/analytics/overview (admin only) is in admin.ts.
 */
import { Hono } from 'hono';
import { getDb, schema } from '../db';
import type { Env } from '../env';
import { clientIp } from '../lib/rate-limit';
import { rateLimit } from '../lib/rate-limit';

const app = new Hono<{ Bindings: Env }>();

async function sha256Prefix(s: string, bytes = 8): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).slice(0, bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

app.post('/pv', async (c) => {
  const env = c.env as Env;
  const rl = rateLimit(`pv:${clientIp(c.req.raw)}`, { windowMs: 60_000, max: 60 });
  if (!rl.ok) return c.json({ ok: true, throttled: true });
  let b: any = {};
  try { b = await c.req.json(); } catch { return c.json({ ok: false }, 400); }
  const path = String(b.path || '/').slice(0, 300);
  const ref = typeof b.referrer === 'string' ? b.referrer.slice(0, 300) : null;
  const sid = typeof b.sessionId === 'string' ? b.sessionId.slice(0, 64) : null;
  const aid = typeof b.anonId === 'string' ? b.anonId.slice(0, 64) : null;
  const ipRaw = clientIp(c.req.raw) || '';
  const ipHash = ipRaw ? await sha256Prefix(ipRaw, 4) : null;
  const ua = c.req.header('user-agent') || '';
  const uaHash = ua ? await sha256Prefix(ua, 6) : null;
  // Country is not resolved here to avoid geo-IP dependency; safe default.
  const db = getDb(env);
  try {
    await db.insert(schema.pageViews).values({
      id: crypto.randomUUID(), path, referrer: ref, sessionId: sid, anonId: aid,
      userAgentHash: uaHash, country: null,
      utmSource: typeof b.utmSource === 'string' ? b.utmSource.slice(0, 80) : null,
      utmMedium: typeof b.utmMedium === 'string' ? b.utmMedium.slice(0, 80) : null,
      utmCampaign: typeof b.utmCampaign === 'string' ? b.utmCampaign.slice(0, 120) : null,
    });
  } catch { /* Never fail the page on analytics errors */ }
  return c.json({ ok: true });
});

export default app;
