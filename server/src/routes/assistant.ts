import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { AIConfigError, getAI } from '../ai';
import { PUBLIC_SYSTEM_PROMPT } from '../ai/agents/system-prompts';
import { PUBLIC_TOOLS, buildHandlers } from '../ai/tools';
import { basePublicContext, retrievePublic } from '../retrieval';
import { rateLimit, clientIp } from '../lib/rate-limit';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

const HISTORY_LIMIT = 10;
const MAX_MSG = 1500;

function sanitize(v: unknown, max = MAX_MSG): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
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

app.post('/chat', async (c) => {
  const env = c.env as Env;
  const ip = clientIp(c.req.raw, env as unknown as Record<string, string | undefined>);
  const rl = rateLimit(`chat:${ip}`, { windowMs: 60_000, max: 20 });
  if (!rl.ok) return c.json({ error: 'Too many requests', retryAfter: rl.retryAfter }, 429);

  let body: { message?: unknown; anonId?: unknown; name?: unknown; email?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  let anonId = typeof body.anonId === 'string' && body.anonId.length <= 64 ? body.anonId : genAnonId();
  const name = sanitize(body.name, 80);
  const email = sanitize(body.email, 160);

  const db = getDb(env);

  // Session
  let [session] = await db.select().from(schema.assistantSessions).where(eq(schema.assistantSessions.anonId, anonId)).limit(1);
  if (!session) {
    [session] = await db.insert(schema.assistantSessions).values({ anonId, name, email }).returning();
  } else if ((name && session.name !== name) || (email && session.email !== email)) {
    await db.update(schema.assistantSessions)
      .set({ name: name ?? session.name, email: email ?? session.email, lastMessageAt: new Date() })
      .where(eq(schema.assistantSessions.id, session.id));
  }
  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'user', content: message });

  // History
  const historyRows = await db.select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content })
    .from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, session.id))
    .orderBy(desc(schema.assistantMessages.createdAt)).limit(HISTORY_LIMIT);
  historyRows.reverse();

  // Compact base public context (services/pricing/FAQ summary)
  const baseCtx = await basePublicContext(db);

  // Optional retrieval: pull documents relevant to THIS query so the model
  // doesn't have to search blindly. We feed this as a single user-prefixed
  // context block, then let the model decide if it needs more via tools.
  const retrieved = await retrievePublic(db, message, { limit: 4 });
  const retrievalText = retrieved.length
    ? `Potentially relevant information from the website (for this specific question):\n${retrieved.map(d => `- [${d.kind}] ${d.title}${d.url ? ` (${d.url})` : ''}: ${d.snippet}`).join('\n')}\n(Use search_* tools if you need more detail.)`
    : '';

  const systemContent = `${PUBLIC_SYSTEM_PROMPT}\n\n${baseCtx}\n\nCONVERSATION STATE:\n- You are talking to a visitor.${name ? ` Their name is ${name}.` : ''}${email ? ` Email on file: ${email}.` : ''}${session.capturedLeadId ? ` A lead already exists for this session (ref ${session.capturedLeadId}); do not create another.` : ''}\n- Be helpful. If they want to start a project, call create_lead only after you have name, email, and a short brief.`;

  const messages = [
    { role: 'system' as const, content: systemContent },
    ...historyRows.slice(0, -1).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })), // all but the current user message
  ];
  if (retrievalText) messages.push({ role: 'user' as const, content: retrievalText });
  messages.push({ role: 'user' as const, content: message });

  // Decide tier: simple greetings/FAQs → fast; anything that might need
  // qualification or tool-use → standard (MiniMax supports tools).
  const simple = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|good|great|sure)([.!?,]|$)/i.test(message.trim()) && message.length < 40;
  const tier: 'fast' | 'standard' = (simple || message.length < 25) ? 'fast' : 'standard';

  let reply: string;
  let model = '';
  let usedFallback = false;
  let toolCalls: any[] = [];
  try {
    const ai = getAI(env);
    const tools = tier === 'fast' ? [] : PUBLIC_TOOLS; // no tool use on the fast model (it doesn't support tools reliably)
    const result = await ai.run(
      {
        messages,
        tier,
        tools,
        maxTurns: 6,
        maxTokens: tier === 'fast' ? 250 : 700,
        timeoutMs: tier === 'fast' ? 10_000 : 25_000,
      },
      buildHandlers({ kind: 'public', auth: null, db, env, ip, session: { id: session.id, anonId, capturedLeadId: session.capturedLeadId, intent: session.intent } }),
      { kind: 'public', auth: null, db, env, ip, session: { id: session.id, anonId, capturedLeadId: session.capturedLeadId, intent: session.intent } },
    );
    reply = result.content;
    model = result.model;
    usedFallback = result.usedFallback;
    toolCalls = result.toolCalls;
  } catch (e) {
    if (e instanceof AIConfigError) {
      reply = "Tolesh is still being connected to the AI provider — in the meantime, please start a project at /start-project or email hello@toluenetech.com.";
    } else {
      reply = "I'm having trouble reaching our models right now. Please try again in a moment, or go to /start-project to send us a direct message.";
    }
  }

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
  await db.update(schema.assistantSessions).set({ lastMessageAt: new Date() }).where(eq(schema.assistantSessions.id, session.id));

  return c.json({
    reply, anonId,
    model, usedFallback,
    toolCalls: toolCalls.map(t => ({ name: t.name, ok: t.ok })),
  });
});

export default app;
