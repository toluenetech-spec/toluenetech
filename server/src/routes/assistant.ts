import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { AIConfigError, AIError, getAI } from '../ai';
import { PUBLIC_SYSTEM_PROMPT } from '../ai/agents/system-prompts';
import { PUBLIC_TOOLS, buildHandlers } from '../ai/tools';
import { basePublicContext, retrievePublic } from '../retrieval';
import { rateLimit, clientIp } from '../lib/rate-limit';
import { resolveForSurface } from '../ai/surface-config';
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

/** Heuristic: short greetings / yes-no answers → fast tier (no tools needed). */
function classifyTier(msg: string): 'fast' | 'standard' {
  const trimmed = msg.trim();
  if (trimmed.length < 12) return 'fast';
  const simple = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|good|great|sure|bye|goodbye|yo|sup)([.!?,]|\s|$)/i.test(trimmed);
  // No tool needed — direct factual answer can come from the fast model.
  const directAnswer = /^what is \d+\s*[+\-*/x×÷]\s*\d+[?.!]?$/i.test(trimmed) ||
                       /^tell me a joke/i.test(trimmed) ||
                       /^who are you/i.test(trimmed) ||
                       /^(hi|hello|hey)\s*(!|\.|$)/i.test(trimmed);
  if ((simple && trimmed.length < 50) || directAnswer) return 'fast';
  return 'standard';
}

app.get('/session', async (c) => {
  let anonId = c.req.header('X-Anon-Id');
  if (!anonId || anonId.length > 64) anonId = genAnonId();
  return c.json({ anonId });
});

app.post('/chat', async (c) => {
  const env = c.env as Env;
  const ip = clientIp(c.req.raw);
  const rl = rateLimit(`chat:${ip}`, { windowMs: 60_000, max: 25 });
  if (!rl.ok) return c.json({ error: 'Too many requests — please slow down a moment.' }, 429);

  let body: { message?: unknown; anonId?: unknown; name?: unknown; email?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  let anonId = typeof body.anonId === 'string' && body.anonId.length <= 64 ? body.anonId : genAnonId();
  const name = sanitize(body.name, 80);
  const email = sanitize(body.email, 160);

  const db = getDb(env);
  let session;
  try {
    [session] = await db.select().from(schema.assistantSessions).where(eq(schema.assistantSessions.anonId, anonId)).limit(1);
    if (!session) {
      [session] = await db.insert(schema.assistantSessions).values({ anonId, name: name ?? null, email: email ?? null }).returning();
    } else if ((name && session.name !== name) || (email && session.email !== email)) {
      await db.update(schema.assistantSessions)
        .set({ name: name ?? session.name, email: email ?? session.email, lastMessageAt: new Date() })
        .where(eq(schema.assistantSessions.id, session.id));
    }
    await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'user', content: message });
  } catch (dbErr) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), ai: 'public', event: 'db_error', phase: 'session', cause: String((dbErr as Error).message).slice(0, 400) }));
    return c.json({ error: 'A database error occurred — please try again.' }, 500);
  }

  const historyRows = await db.select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content })
    .from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, session.id))
    .orderBy(desc(schema.assistantMessages.createdAt)).limit(HISTORY_LIMIT);
  historyRows.reverse();

  let baseCtx = '';
  let retrieved: any[] = [];
  try {
    baseCtx = await basePublicContext(db);
    retrieved = await retrievePublic(db, message, { limit: 4 });
  } catch (dbErr) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), ai: 'public', event: 'db_error', phase: 'retrieval', cause: String((dbErr as Error).message).slice(0, 400) }));
    // Continue with empty context rather than failing the whole chat
  }

  const retrievalText = retrieved.length
    ? `Potentially relevant information from the website (for this specific question):\n${retrieved.map(d => `- [${d.kind}] ${d.title}${d.url ? ` (${d.url})` : ''}: ${d.snippet}`).join('\n')}\n(Use search_* tools if you need more detail.)`
    : '';

  const systemContent = `${PUBLIC_SYSTEM_PROMPT}\n\n${baseCtx}\n\nCONVERSATION STATE:\n- You are talking to a visitor.${name ? ` Their name is ${name}.` : ''}${email ? ` Email on file: ${email}.` : ''}${session.capturedLeadId ? ` A lead already exists for this session (ref ${session.capturedLeadId}); do not create another.` : ''}\n- Be helpful. If they want to start a project, call create_lead only after you have name, email, and a short brief.`;

  const messages = [
    { role: 'system' as const, content: systemContent },
    ...historyRows.slice(0, -1).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
  ];
  if (retrievalText) messages.push({ role: 'user' as const, content: retrievalText });
  messages.push({ role: 'user' as const, content: message });

  const tier = classifyTier(message);
  // Fast tier: still allow tools? The fast model supports tools on Dahl, but for
  // the fastest greetings we skip them to reduce latency. For anything over the
  // simple threshold we always allow tools so we can answer service/portfolio/pricing
  // questions with real data.
  const tools = tier === 'fast' ? [] : PUBLIC_TOOLS;

  let reply: string;
  let model = '';
  let usedFallback = false;
  let toolCalls: any[] = [];
  let userError: string | null = null;
  try {
    const ai = getAI(env);
    // Use public surface config (primary + fallback) from DB+env+defaults.
    const surf = await resolveForSurface(env, 'public');
    // Tier override: keep fast responses tight; standard uses surface defaults.
    const effectiveMaxTokens = tier === 'fast' ? Math.min(300, surf.maxTokens) : surf.maxTokens;
    const effectiveTimeout = tier === 'fast' ? Math.min(15_000, surf.timeoutMs) : surf.timeoutMs;
    // Filter tools to whitelist if configured; otherwise use surface default.
    const effectiveTools = tools.length === 0 ? [] : (surf.toolsEnabled ? tools.filter(t => surf.toolsEnabled!.includes(t.name)) : tools);
    const result = await ai.run(
      {
        messages,
        model: surf.primary,
        fallbackModels: surf.fallbackChain.slice(1),
        tier,
        tools: effectiveTools,
        maxTurns: 6,
        maxTokens: effectiveMaxTokens,
        timeoutMs: effectiveTimeout,
        label: 'public',
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
      reply = "Tolesh is still being connected — in the meantime please use /start-project or email hello@toluenetech.com.";
      userError = 'config';
    } else if (e instanceof AIError) {
      reply = friendlyReplyFor(e.info.code);
      userError = e.info.code;
    } else {
      reply = friendlyReplyFor('MODEL_ERROR');
      userError = 'MODEL_ERROR';
    }
  }

  try {
    await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
    await db.update(schema.assistantSessions).set({ lastMessageAt: new Date() }).where(eq(schema.assistantSessions.id, session.id));
  } catch { /* non-fatal */ }

  return c.json({
    reply, anonId, model, usedFallback, error: userError ?? undefined,
    toolCalls: toolCalls.map(t => ({ name: t.name, ok: t.ok })),
  });
});

function friendlyReplyFor(code: string): string {
  switch (code) {
    case 'TIMEOUT':
      return "That took longer than expected. Could you try again with a shorter question, or visit /start-project to message us directly?";
    case 'DATABASE_ERROR':
      return "I hit a problem looking up that information. Our team has been notified — please try again shortly, or browse the Services page directly.";
    case 'TOOL_ERROR':
      return "I couldn't pull the information you asked for right now. Please try again, or browse the Services/Portfolio pages directly.";
    case 'CONFIG_ERROR':
      return "Tolesh is still being set up — please visit /start-project or email hello@toluenetech.com in the meantime.";
    case 'EMPTY_MODEL_RESPONSE':
      return "I didn't get a complete answer back from our model. Please try again.";
    case 'MODEL_ERROR':
    case 'FALLBACK_ERROR':
    default:
      return "I'm having trouble reaching our models right now. Please try again in a moment, or go to /start-project to send us a direct message.";
  }
}

export default app;
