import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { AIConfigError, getAI } from '../ai';
import { ADMIN_SYSTEM_PROMPT } from '../ai/agents/system-prompts';
import { ADMIN_TOOLS, buildHandlers } from '../ai/tools';
import { basePublicContext, adminSummary } from '../retrieval';
import { rateLimit, clientIp } from '../lib/rate-limit';
import { authAdmin } from '../lib/auth';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

const HISTORY_LIMIT = 12;
const MAX_MSG = 2000;

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
  try { auth = await authAdmin(c.req.raw, env); } catch { return c.json({ error: 'Unauthorized' }, 401); }

  const ip = clientIp(c.req.raw, env as unknown as Record<string,string|undefined>);
  const rl = rateLimit(`admin-chat:${auth.uid}:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) return c.json({ error: 'Rate limit exceeded' }, 429);

  let body: { message?: unknown; anonId?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  const db = getDb(env);

  let admName = auth.name ?? auth.email;
  if (auth.uid !== 'local-admin') {
    const [row] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.uid, auth.uid)).limit(1);
    if (!row) return c.json({ error: 'Forbidden' }, 403);
    admName = row.name ?? row.email;
  }

  let anonId = typeof body.anonId === 'string' && body.anonId.startsWith('adm_') ? body.anonId : genAnonId();
  let [session] = await db.select().from(schema.assistantSessions).where(eq(schema.assistantSessions.anonId, anonId)).limit(1);
  if (!session) {
    [session] = await db.insert(schema.assistantSessions).values({ anonId, name: admName }).returning();
  }
  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'user', content: message });

  const history = await db.select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content })
    .from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, session.id))
    .orderBy(desc(schema.assistantMessages.createdAt)).limit(HISTORY_LIMIT);
  history.reverse();

  // Admin CRM snapshot (concise — full detail is fetched via tools)
  const [cms, summary] = await Promise.all([basePublicContext(db), adminSummary(db)]);

  const systemContent = `${ADMIN_SYSTEM_PROMPT}\n\n${cms}\n\nADMIN SNAPSHOT:\n- User: ${admName} (${auth.email})\n- New (NEW) leads: ${summary.newLeads}\n- Total leads: ${summary.totalLeads}\n- Total client projects: ${summary.totalProjects}\n- 8 most recent leads are available via admin_list_leads.\n\nIMPORTANT: use the admin_* tools for any specific lead/project question. Do not guess numbers. Drafted replies are NOT sent — tell the admin that clearly.`;

  const messages = [
    { role: 'system' as const, content: systemContent },
    ...history.slice(0, -1).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ];

  let reply: string;
  let toolCalls: any[] = [];
  let model = '';
  try {
    const ai = getAI(env);
    const r = await ai.run(
      {
        messages,
        tier: 'reasoning',
        tools: ADMIN_TOOLS,
        maxTurns: 6,
        maxTokens: 900,
        timeoutMs: 30_000,
      },
      buildHandlers({ kind: 'admin', auth: { uid: auth.uid, email: auth.email, name: admName, role: 'ADMIN' }, db, env, ip }),
      { kind: 'admin', auth: { uid: auth.uid, email: auth.email, name: admName, role: 'ADMIN' }, db, env, ip },
    );
    reply = r.content;
    model = r.model;
    toolCalls = r.toolCalls;
  } catch (e) {
    if (e instanceof AIConfigError) {
      reply = "AI provider isn't configured yet for admin — set AI_PROVIDER and AI_API_KEY secrets.";
    } else {
      reply = "I hit an error reaching the model. Please try again in a moment.";
    }
  }

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
  await db.update(schema.assistantSessions).set({ lastMessageAt: new Date() }).where(eq(schema.assistantSessions.id, session.id));

  return c.json({ reply, anonId, model, toolCalls: toolCalls.map(t => ({ name: t.name, ok: t.ok })) });
});

export default app;
