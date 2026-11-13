import { Hono } from 'hono';
import { eq, desc, and, gte } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { rateLimit, clientIp } from '../lib/rate-limit';
import type { Env } from '../env';
import { ApiError, jsonError } from '../lib/errors';

const app = new Hono<{ Bindings: Env }>();
app.onError((err, c) => jsonError(c, err));

interface LeadInput {
  name?: unknown; email?: unknown; phone?: unknown; company?: unknown;
  services?: unknown; requirements?: unknown; budget?: unknown; timeline?: unknown;
  source?: unknown; sourcePage?: unknown; aiRef?: unknown; honeypot?: unknown;
}

function sanitizeStr(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}
function validateEmail(v: string | null): boolean {
  return !!v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 240;
}
async function nextLeadRef(db: ReturnType<typeof getDb>): Promise<string> {
  const [last] = await db.select({ ref: schema.leads.ref }).from(schema.leads)
    .orderBy(desc(schema.leads.createdAt)).limit(1);
  const num = last?.ref ? parseInt(last.ref.replace(/\D/g, ''), 10) || 0 : 0;
  return `TT-${String(num + 1).padStart(4, '0')}`;
}

/** Public lead submission. */
app.post('/', async (c) => {
  const env = c.env as Env;
  const ip = clientIp(c.req.raw);
  const rl = rateLimit(`lead:${ip}`, { windowMs: 60_000, max: 5 });
  if (!rl.ok) throw new ApiError({ code: 'RATE_LIMITED', message: 'Too many submissions — try again in a moment.' });

  let body: LeadInput;
  try { body = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON body.' }); }

  const name = sanitizeStr(body.name, 160);
  const email = sanitizeStr(body.email, 240);
  if (!name) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Name is required.' });
  if (!validateEmail(email)) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'A valid email is required.' });

  // Honeypot anti-bot.
  const bot = typeof body.honeypot === 'string' && body.honeypot.length > 0;

  const phone = sanitizeStr(body.phone, 40);
  const company = sanitizeStr(body.company, 180);
  const requirements = sanitizeStr(body.requirements, 4000);
  const budget = sanitizeStr(body.budget, 80);
  const timeline = sanitizeStr(body.timeline, 80);
  const source = bot ? 'spam' : (sanitizeStr(body.source, 80) ?? 'website-form');
  const sourcePage = sanitizeStr(body.sourcePage, 300);
  const aiRef = sanitizeStr(body.aiRef, 64);

  const allowedSources = new Set(['contact','service','portfolio','assistant','ai-lab','whatsapp','direct','referral','other','unknown','website-form','manual','spam']);
  const finalSource = allowedSources.has(source) ? source : 'unknown';

  let services: string[] = [];
  if (Array.isArray(body.services)) {
    services = body.services.filter((s): s is string => typeof s === 'string').map(s => s.slice(0, 120)).slice(0, 10);
  }

  const db = getDb(env);

  // Dedupe: recent lead with same email within 24h.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [dup] = await db.select().from(schema.leads)
    .where(and(eq(schema.leads.email, email!), gte(schema.leads.createdAt, dayAgo)))
    .orderBy(desc(schema.leads.createdAt)).limit(1);
  if (dup && dup.status !== 'LOST' && dup.status !== 'ARCHIVED') {
    return c.json({ success: true, data: { ref: dup.ref, id: dup.id, deduped: true } }, 200);
  }

  const ref = await nextLeadRef(db);
  const [lead] = await db.insert(schema.leads).values({
    ref, name, email: email!,
    phone: phone ?? undefined, company: company ?? undefined,
    requirements: requirements ?? undefined,
    budget: budget ?? undefined, timeline: timeline ?? undefined,
    source: finalSource,
    sourcePage: sourcePage ?? undefined,
    aiRef: aiRef ?? undefined,
    services, status: 'NEW',
  }).returning();

  return c.json({ success: true, data: { ref: lead.ref, id: lead.id } }, 201);
});

export default app;
