import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { getAIProvider, AIConfigError } from '../ai';
import { stripThinking } from '../ai/strip-thinking';
import { buildSystemPrompt } from '../assistant/prompt';
import { rateLimit, clientIp } from '../lib/rate-limit';
import { authClient } from '../lib/auth';
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
  return 'cli_' + Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
}

app.post('/', async (c) => {
  const env = c.env as Env;
  let auth;
  try { auth = await authClient(c.req.raw, env); }
  catch { return c.json({ error: 'Unauthorized' }, 401); }

  const ip = clientIp(c.req.raw, env as unknown as Record<string,string|undefined>);
  const rl = rateLimit(`client-chat:${auth.uid}:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) return c.json({ error: 'Rate limit exceeded' }, 429);

  let body: { message?: unknown; anonId?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  const db = getDb(env);

  // find the client record for this firebase uid
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.userId, auth.uid)).limit(1);
  if (!client) {
    // Allow demo fallback: demo@toluenetech.com maps to client-demo
    if (auth.email === 'demo@toluenetech.com') {
      // continue with a synthetic client id
    } else {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }
  const clientId = client?.id ?? 'client-demo';

  let anonId = typeof body.anonId === 'string' && body.anonId.startsWith('cli_') ? body.anonId : genAnonId();
  let sessions = await db.select().from(schema.assistantSessions).where(eq(schema.assistantSessions.anonId, anonId)).limit(1);
  let session = sessions[0];
  if (!session) {
    const [s] = await db.insert(schema.assistantSessions).values({ anonId, name: client?.name ?? auth.email }).returning();
    session = s;
  }
  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'user', content: message });

  let ai;
  try { ai = getAIProvider(env); }
  catch (e) {
    if (e instanceof AIConfigError) return c.json({ reply: "Tolesh is still being set up on this workspace — please check back shortly.", anonId, providerMissing: true });
    throw e;
  }

  const history = await db.select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content })
    .from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, session.id))
    .orderBy(desc(schema.assistantMessages.createdAt)).limit(HISTORY_LIMIT);
  history.reverse();

  // Load the client's projects + milestones + latest messages
  const projects = clientId === 'client-demo'
    ? [] as any[]
    : await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.clientId, clientId));
  const projectIds = projects.map(p => p.id);
  const [milestones, msgs] = projectIds.length
    ? await Promise.all([
        db.select().from(schema.milestones).where((await import('drizzle-orm')).inArray(schema.milestones.projectId, projectIds)),
        db.select().from(schema.messages).where(
          and(
            eq(schema.messages.contextType, 'PROJECT'),
            (await import('drizzle-orm')).inArray(schema.messages.contextId, projectIds)
          )
        ).orderBy(desc(schema.messages.createdAt)).limit(10),
      ])
    : [[], []];

  const clientContext = `You are Tolesh for Clients. You are speaking to ${client?.name ?? 'a client'} (${client?.company ?? ''}).

CLIENT-SPECIFIC DATA (only share this with the logged-in client; never mention other clients):
${projects.length ? projects.map(p => `- Project: ${p.title} — status ${p.status}, progress ${p.progress}%, due ${p.dueDate ?? 'TBD'}`).join('\n') : '- No active projects on record yet.'}

Milestones:
${milestones.length ? milestones.map(m => `- [${m.status}] ${m.title}${m.dueDate ? ' (due ' + new Date(m.dueDate).toISOString().slice(0,10) + ')' : ''}`).join('\n') : '- (none on record)'}

Recent messages (newest first):
${msgs.length ? msgs.slice().reverse().map(m => `- ${m.fromName}: ${m.body.slice(0, 240)}`).join('\n') : '- (none yet)'}

Rules:
- Never share information about other clients or internal Toluene Tech details.
- You can summarize project status, milestones, and refer the client to recent files/messages.
- If they ask for work that requires action (file uploads, scope changes, invoices), tell them the team will respond via the messages tab and point them to the relevant portal section.
- Keep answers concise and helpful. If you don't know something, say you'll flag it for the team.`;

  const system = buildSystemPrompt({ cmsContext: clientContext });
  const messages = [
    { role: 'system' as const, content: system },
    ...history.map(h => ({ role: h.role as 'user'|'assistant', content: h.content })),
  ];

  let reply: string;
  try { reply = await ai.chat(messages); }
  catch { reply = "I hit an error reaching the model — please try again in a moment."; }
  reply = stripThinking(reply);

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
  return c.json({ reply, anonId });
});

export default app;
