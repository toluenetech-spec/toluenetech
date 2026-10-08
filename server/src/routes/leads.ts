import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { rateLimit, clientIp } from '../lib/rate-limit';
import type { Env } from '../env';
import { ApiError, jsonError } from '../lib/errors';

const app = new Hono<{ Bindings: Env }>();
app.onError((err, c) => jsonError(c, err));

interface LeadInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  services?: unknown;
  requirements?: unknown;
  budget?: unknown;
  timeline?: unknown;
  source?: unknown;
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

/** Public lead submission from /start-project or /contact or assistant. */
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

  const phone = sanitizeStr(body.phone, 40);
  const company = sanitizeStr(body.company, 180);
  const requirements = sanitizeStr(body.requirements, 4000);
  const budget = sanitizeStr(body.budget, 80);
  const timeline = sanitizeStr(body.timeline, 80);
  const source = sanitizeStr(body.source, 80) ?? 'website-form';

  let services: string[] = [];
  if (Array.isArray(body.services)) {
    services = body.services.filter((s): s is string => typeof s === 'string').map(s => s.slice(0, 120)).slice(0, 10);
  }

  const db = getDb(env);
  const ref = await nextLeadRef(db);

  const [lead] = await db.insert(schema.leads).values({
    ref,
    name,
    email: email!,
    phone: phone ?? undefined,
    company: company ?? undefined,
    requirements: requirements ?? undefined,
    budget: budget ?? undefined,
    timeline: timeline ?? undefined,
    source,
    services,
    status: 'NEW',
  }).returning();

  return c.json({ success: true, data: { ref: lead.ref, id: lead.id } }, 201);
});

export default app;
