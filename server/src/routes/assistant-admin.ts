import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { getAIProvider, AIConfigError } from '../ai';
import { stripThinking } from '../ai/strip-thinking';
import { buildSystemPrompt } from '../assistant/prompt';
import { buildPublicContext } from '../assistant/context';
import { rateLimit, clientIp } from '../lib/rate-limit';
import { authAdmin } from '../lib/auth';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

const HISTORY_LIMIT = 10;
const MAX_MSG = 1000;

function sanitize(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, MAX_MSG).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

function genAnonId(): string {
  const b = new Uint8Array(12); crypto.getRandomValues(b);
  return 'adm_' + Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
}

app.post('/', async (c) => {
  const env = c.env as Env;
  let auth;
  try { auth = await authAdmin(c.req.raw, env); }
  catch { return c.json({ error: 'Unauthorized' }, 401); }

  const ip = clientIp(c.req.raw, env as unknown as Record<string,string|undefined>);
  const rl = rateLimit(`admin-chat:${auth.uid}:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) return c.json({ error: 'Rate limit exceeded' }, 429);

  let body: { message?: unknown; anonId?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  const db = getDb(env);

  // admin gate — if uid is not 'local-admin', must be in admin_users table.
  let admName = auth.name ?? auth.email;
  if (auth.uid !== 'local-admin') {
    const [row] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.uid, auth.uid)).limit(1);
    if (!row) return c.json({ error: 'Forbidden' }, 403);
    admName = row.name ?? row.email;
  }

  let anonId = typeof body.anonId === 'string' && body.anonId.startsWith('adm_') ? body.anonId : genAnonId();

  let sessions = await db.select().from(schema.assistantSessions).where(eq(schema.assistantSessions.anonId, anonId)).limit(1);
  let session = sessions[0];
  if (!session) {
    const [s] = await db.insert(schema.assistantSessions).values({ anonId, name: admName }).returning();
    session = s;
  }

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'user', content: message });

  let ai;
  try { ai = getAIProvider(env); }
  catch (e) {
    if (e instanceof AIConfigError) {
      return c.json({ reply: "AI provider isn't configured yet. Add AI_PROVIDER and AI_API_KEY secrets to enable Tolesh Admin.", anonId, providerMissing: true });
    }
    throw e;
  }

  const history = await db.select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content })
    .from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, session.id))
    .orderBy(desc(schema.assistantMessages.createdAt)).limit(HISTORY_LIMIT);
  history.reverse();

  // Pull admin context: counts + latest leads, etc.
  const [newLeadCount, latestLeads, projectCount] = await Promise.all([
    db.select({ c: (await import('drizzle-orm')).sql<number>`count(*)::int` }).from(schema.leads).where(eq(schema.leads.status, 'NEW')),
    db.select({ ref: schema.leads.ref, name: schema.leads.name, email: schema.leads.email, status: schema.leads.status, createdAt: schema.leads.createdAt })
      .from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(5),
    db.select({ c: (await import('drizzle-orm')).sql<number>`count(*)::int` }).from(schema.clientProjects),
  ]);

  const cms = await buildPublicContext(db);

  const adminContext = `${cms}

ADMIN CONTEXT (you are Tolesh Admin assistant, speaking to an internal admin user ${admName}):
- New (NEW status) leads: ${newLeadCount[0]?.c ?? 0}
- Total client projects: ${projectCount[0]?.c ?? 0}
- Latest 5 leads (newest first):
${(latestLeads ?? []).map(l => `  • ${l.ref} — ${l.name} <${l.email}> [${l.status}]`).join('\n')}

You can answer questions about services/FAQ/pricing (from the public content above) as well as leads/clients counts.
You can also draft replies to leads (address them by first name, reference their ref, keep it short and professional).
Do NOT fabricate numbers or leads beyond what's listed above. If you don't know, say so.
When asked to take an action (update status, send an email), reply that automation actions are rolling out in the next release and that the admin can do it manually from the relevant page for now — but note the request so the team can see it in the message log.`;

  const system = buildSystemPrompt({ cmsContext: adminContext });
  const messages = [
    { role: 'system' as const, content: system },
    ...history.map(h => ({ role: h.role as 'user'|'assistant', content: h.content })),
  ];

  let reply: string;
  try { reply = await ai.chat(messages); }
  catch { reply = "I hit an error reaching the model. Try again in a moment."; }
  reply = stripThinking(reply);

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
  return c.json({ reply, anonId });
});

export default app;
