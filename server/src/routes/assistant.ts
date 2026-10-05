import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { getAIProvider, AIConfigError } from '../ai';
import { buildSystemPrompt } from '../assistant/prompt';
import { buildPublicContext } from '../assistant/context';
import { rateLimit, clientIp } from '../lib/rate-limit';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

const MAX_MSG_LEN = 1000;
const HISTORY_LIMIT = 8; // last N messages to keep as context per request

function sanitize(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.slice(0, MAX_MSG_LEN).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

function genAnonId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

app.get('/session', async (c) => {
  let anonId = c.req.header('X-Anon-Id');
  if (!anonId || anonId.length > 64) anonId = genAnonId();
  return c.json({ anonId });
});

app.post('/chat', async (c) => {
  const env = c.env as Env;
  const ip = clientIp(c.req.raw, env as unknown as Record<string, string | undefined>);
  const rl = rateLimit(`chat:${ip}`, { windowMs: 60_000, max: 15 });
  if (!rl.ok) {
    return c.json({ error: 'Too many requests', retryAfter: rl.retryAfter }, 429);
  }

  let body: { message?: unknown; anonId?: unknown; name?: unknown; email?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  let anonId = typeof body.anonId === 'string' && body.anonId.length <= 64 ? body.anonId : genAnonId();
  const name = typeof body.name === 'string' ? sanitize(body.name).slice(0, 80) : null;
  const email = typeof body.email === 'string' ? sanitize(body.email).slice(0, 160) : null;

  const db = getDb(env);

  // find or create session
  let sessions = await db.select().from(schema.assistantSessions)
    .where(eq(schema.assistantSessions.anonId, anonId)).limit(1);
  let session = sessions[0];
  if (!session) {
    const [newSess] = await db.insert(schema.assistantSessions).values({
      anonId,
      name: name ?? null,
      email: email ?? null,
    }).returning();
    session = newSess;
  } else if ((name && session.name !== name) || (email && session.email !== email)) {
    await db.update(schema.assistantSessions)
      .set({ name: name ?? session.name, email: email ?? session.email, lastMessageAt: new Date() })
      .where(eq(schema.assistantSessions.id, session.id));
  }

  // store user message
  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'user', content: message });

  // provider check
  let ai;
  try { ai = getAIProvider(env); }
  catch (e) {
    if (e instanceof AIConfigError) {
      return c.json({
        reply: "The assistant isn't connected to an AI provider yet — we're wiring that up right now. In the meantime, feel free to start a project at /start-project or email hello@toluenetech.com.",
        anonId,
        providerMissing: true,
      }, 200);
    }
    throw e;
  }

  // load history + CMS context
  const history = await db.select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content })
    .from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, session.id))
    .orderBy(desc(schema.assistantMessages.createdAt))
    .limit(HISTORY_LIMIT);
  history.reverse();

  const cmsContext = await buildPublicContext(db);

  const system = buildSystemPrompt({ cmsContext });
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: system },
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
  ];

  let reply: string;
  try {
    reply = await ai.chat(messages);
  } catch (err) {
    reply = "I'm having a little trouble reaching our AI right now. Please try again in a minute, or go straight to /start-project to tell us what you're building.";
  }

  // store assistant message
  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
  await db.update(schema.assistantSessions)
    .set({ lastMessageAt: new Date() })
    .where(eq(schema.assistantSessions.id, session.id));

  // lead-capture heuristic: if user provided email and message signals intent, create lead
  const intent = detectIntent(message);
  if (email && intent && !session.capturedLeadId) {
    try {
      const ref = await nextLeadRef(db);
      const [lead] = await db.insert(schema.leads).values({
        ref,
        name: name ?? 'Website visitor (assistant)',
        email,
        source: 'assistant',
        requirements: message,
        status: 'NEW',
      }).returning();
      await db.update(schema.assistantSessions)
        .set({ capturedLeadId: lead.id, intent })
        .where(eq(schema.assistantSessions.id, session.id));
    } catch { /* lead capture is best-effort */ }
  } else if (intent && !session.intent) {
    await db.update(schema.assistantSessions).set({ intent }).where(eq(schema.assistantSessions.id, session.id));
  }

  return c.json({ reply, anonId });
});

function detectIntent(msg: string): 'start-project' | 'pricing' | null {
  const l = msg.toLowerCase();
  if (/\b(hi(re|ring)|quote|project|build|start|want|need|hire|cost|budget|price|estimate)\b/.test(l)) {
    return /\b(cost|budget|price|estimate|how much)\b/.test(l) ? 'pricing' : 'start-project';
  }
  return null;
}

async function nextLeadRef(db: ReturnType<typeof getDb>): Promise<string> {
  const [row] = await db.select({ ref: schema.leads.ref }).from(schema.leads)
    .orderBy(desc(schema.leads.createdAt)).limit(1);
  const lastNum = row?.ref ? parseInt(row.ref.replace(/\D/g, ''), 10) || 0 : 0;
  return `TT-${String(lastNum + 1).padStart(4, '0')}`;
}

export default app;
