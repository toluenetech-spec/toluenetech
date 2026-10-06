import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { getAIProvider, AIConfigError } from '../ai';
import { buildSystemPrompt } from '../assistant/prompt';
import { buildPublicContext } from '../assistant/context';
import { rateLimit, clientIp } from '../lib/rate-limit';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

const HISTORY_LIMIT = 8;
const MAX_MSG = 1000;

function sanitize(v: unknown, max = MAX_MSG): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

function genAnonId(): string {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return b.reduce((s, x) => s + x.toString(16).padStart(2, '0'), '');
}

app.get('/session', async (c) => {
  let anonId = c.req.header('X-Anon-Id');
  if (!anonId || anonId.length > 64) anonId = genAnonId();
  return c.json({ anonId });
});

/** Build the ordered list of model IDs to try for the public fast path. */
function publicModelCandidates(env: Env): string[] {
  const out: string[] = [];
  if (env.AI_MODEL_PUBLIC) out.push(env.AI_MODEL_PUBLIC);
  if (env.AI_PROVIDER === 'dahl') {
    // Try several known Dahl fast-model IDs in order of likely availability+speed.
    for (const m of [
      'deepseek-flash',
      'deepseek-v4-flash',
      'DeepSeek-V3-Flash',
      'deepseek-ai/DeepSeek-V3-Flash',
      'deepseek-v3-flash',
      'DeepSeek-R1',
      'MiniMaxAI/MiniMax-M2.7',
    ]) if (!out.includes(m)) out.push(m);
  }
  if (env.AI_MODEL && !out.includes(env.AI_MODEL)) out.push(env.AI_MODEL);
  return out;
}

app.post('/chat', async (c) => {
  const env = c.env as Env;
  const ip = clientIp(c.req.raw, env as unknown as Record<string, string | undefined>);
  const rl = rateLimit(`chat:${ip}`, { windowMs: 60_000, max: 15 });
  if (!rl.ok) return c.json({ error: 'Too many requests', retryAfter: rl.retryAfter }, 429);

  let body: { message?: unknown; anonId?: unknown; name?: unknown; email?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  let anonId = typeof body.anonId === 'string' && body.anonId.length <= 64 ? body.anonId : genAnonId();
  const name = sanitize(body.name, 80);
  const email = sanitize(body.email, 160);

  const db = getDb(env);

  // session
  let [session] = await db.select().from(schema.assistantSessions).where(eq(schema.assistantSessions.anonId, anonId)).limit(1);
  if (!session) {
    [session] = await db.insert(schema.assistantSessions).values({ anonId, name, email }).returning();
  } else if ((name && session.name !== name) || (email && session.email !== email)) {
    await db.update(schema.assistantSessions)
      .set({ name: name ?? session.name, email: email ?? session.email, lastMessageAt: new Date() })
      .where(eq(schema.assistantSessions.id, session.id));
  }

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'user', content: message });

  // history + RAG context
  const historyRows = await db.select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content })
    .from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, session.id))
    .orderBy(desc(schema.assistantMessages.createdAt))
    .limit(HISTORY_LIMIT);
  historyRows.reverse();
  const cmsContext = await buildPublicContext(db);
  const system = buildSystemPrompt({ cmsContext });
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: system },
    ...historyRows.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
  ];

  // Try model candidates in order until one succeeds.
  let reply: string | null = null;
  let configured = false;
  for (const model of publicModelCandidates(env)) {
    try {
      const ai = getAIProvider(env, { model });
      configured = true;
      const r = await ai.chat(messages, { temperature: 0.5, maxTokens: 500 });
      if (r && r.trim().length > 1) { reply = r.trim(); break; }
    } catch (e) {
      if (e instanceof AIConfigError) { configured = false; break; }
      // otherwise try next model
    }
  }

  if (!reply) {
    reply = configured
      ? "I'm hitting a small hiccup reaching our models right now. Please try again in a moment, or go to /start-project to tell us what you're building."
      : "Tolesh AI is being connected to our model provider — we'll be live shortly. In the meantime, start a project at /start-project or email hello@toluenetech.com.";
  }

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
  await db.update(schema.assistantSessions).set({ lastMessageAt: new Date() }).where(eq(schema.assistantSessions.id, session.id));

  // lead capture
  const intent = detectIntent(message);
  if (email && intent && !session.capturedLeadId) {
    try {
      const ref = await nextLeadRef(db);
      const [lead] = await db.insert(schema.leads).values({
        ref, name: name ?? 'Website visitor (assistant)', email,
        source: 'assistant', requirements: message, status: 'NEW',
      }).returning();
      await db.update(schema.assistantSessions)
        .set({ capturedLeadId: lead.id, intent })
        .where(eq(schema.assistantSessions.id, session.id));
    } catch { /* best effort */ }
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
  const [row] = await db.select({ ref: schema.leads.ref }).from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(1);
  const n = row?.ref ? parseInt(row.ref.replace(/\D/g, ''), 10) || 0 : 0;
  return `TT-${String(n + 1).padStart(4, '0')}`;
}

export default app;
