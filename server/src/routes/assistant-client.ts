import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { AIConfigError, AIError, getAI } from '../ai';
import { CLIENT_SYSTEM_PROMPT } from '../ai/agents/system-prompts';
import { CLIENT_TOOLS, buildHandlers } from '../ai/tools';
import { rateLimit, clientIp } from '../lib/rate-limit';
import { authClient } from '../lib/auth';
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
  return 'cli_' + Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
}

const DEMO_PROJECTS = [{
  id: 'cp-demo-1', title: 'Company Website Redesign', status: 'ACTIVE' as const, progress: 55,
  clientId: 'client-demo',
  startDate: new Date('2026-08-01'), dueDate: new Date('2026-10-15'),
}];
const DEMO_MILESTONES = [
  { id: 'ms-1', projectId: 'cp-demo-1', title: 'Discovery & Sitemap', status: 'COMPLETED' as const, order: 1 },
  { id: 'ms-2', projectId: 'cp-demo-1', title: 'Wireframes & Design', status: 'COMPLETED' as const, order: 2 },
  { id: 'ms-3', projectId: 'cp-demo-1', title: 'Development', status: 'IN_PROGRESS' as const, order: 3, dueDate: new Date('2026-09-30') },
  { id: 'ms-4', projectId: 'cp-demo-1', title: 'QA & Launch', status: 'PENDING' as const, order: 4, dueDate: new Date('2026-10-15') },
];
const DEMO_MESSAGES = [{
  id: 'm-demo-1', contextType: 'PROJECT' as const, contextId: 'cp-demo-1',
  fromUid: null as any, fromName: 'Toluene Tech', body: "Welcome to your portal! Track progress, review files, and ask questions about your project here.",
  isRead: true,
}];

async function ensureDemoClient(db: ReturnType<typeof getDb>) {
  const [c] = await db.select().from(schema.clients).where(eq(schema.clients.id, 'client-demo')).limit(1);
  if (!c) {
    await db.insert(schema.clients).values({
      id: 'client-demo', userId: 'demo', name: 'Demo Client', email: 'demo@toluenetech.com', status: 'ACTIVE',
    }).onConflictDoNothing();
  }
  const [p] = await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.id, 'cp-demo-1')).limit(1);
  if (!p) {
    await db.insert(schema.clientProjects).values(DEMO_PROJECTS[0] as any).onConflictDoNothing();
    for (const m of DEMO_MILESTONES) await db.insert(schema.milestones).values(m as any).onConflictDoNothing();
    for (const m of DEMO_MESSAGES) await db.insert(schema.messages).values(m as any).onConflictDoNothing();
  }
}

app.post('/', async (c) => {
  const env = c.env as Env;
  let auth;
  try { auth = await authClient(c.req.raw, env); } catch { return c.json({ error: 'Unauthorized' }, 401); }

  const ip = clientIp(c.req.raw);
  const rl = rateLimit(`client-chat:${auth.uid}:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) return c.json({ error: 'Rate limit exceeded' }, 429);

  let body: { message?: unknown; anonId?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  const db = getDb(env);

  if (auth.clientId === 'client-demo') {
    try { await ensureDemoClient(db); } catch (e) { console.log(JSON.stringify({ ts: new Date().toISOString(), ai: 'client', event: 'demo_bootstrap_error', cause: String((e as Error).message).slice(0,300) })); }
  }

  let anonId = typeof body.anonId === 'string' && body.anonId.startsWith('cli_') ? body.anonId : genAnonId();
  let [session] = await db.select().from(schema.assistantSessions).where(eq(schema.assistantSessions.anonId, anonId)).limit(1);
  if (!session) {
    [session] = await db.insert(schema.assistantSessions).values({ anonId, name: auth.name ?? auth.email }).returning();
  }
  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'user', content: message });

  const history = await db.select({ role: schema.assistantMessages.role, content: schema.assistantMessages.content })
    .from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, session.id))
    .orderBy(desc(schema.assistantMessages.createdAt)).limit(HISTORY_LIMIT);
  history.reverse();

  let clientProjects: any[] = [];
  try {
    clientProjects = auth.clientId === 'client-demo'
      ? await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.clientId, 'client-demo'))
      : await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.clientId, auth.clientId!));
  } catch (e) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), ai: 'client', event: 'db_error', phase: 'projects', cause: String((e as Error).message).slice(0,300) }));
  }
  const projectList = clientProjects.map(p => `- ${p.title} (id=${p.id}, status=${p.status}, progress=${p.progress}%)`).join('\n') || '- No active projects on record.';

  const systemContent = `${CLIENT_SYSTEM_PROMPT}\n\nClient: ${auth.name ?? auth.email} (${auth.email})\n\n${clientProjects.length ? `Active projects:\n${projectList}\nUse client_projects for the full list and client_milestones/client_messages/client_files for details — always pass the projectId returned by client_projects.` : 'No active projects on record.'}`;

  const messages = [
    { role: 'system' as const, content: systemContent },
    ...history.slice(0, -1).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ];

  let reply: string;
  let toolCalls: any[] = [];
  let model = '';
  let usedFallback = false;
  let userError: string | null = null;
  try {
    const ai = getAI(env);
    const r = await ai.run(
      {
        messages,
        tier: 'reasoning',
        tools: CLIENT_TOOLS,
        maxTurns: 5,
        maxTokens: 900,
        timeoutMs: 35_000,
        label: 'client',
      },
      buildHandlers({ kind: 'client', auth: { uid: auth.uid, email: auth.email, name: auth.name, clientId: auth.clientId }, db, env, ip }),
      { kind: 'client', auth: { uid: auth.uid, email: auth.email, name: auth.name, clientId: auth.clientId }, db, env, ip },
    );
    reply = r.content; toolCalls = r.toolCalls; model = r.model; usedFallback = r.usedFallback;
  } catch (e) {
    if (e instanceof AIConfigError) { reply = "Tolesh is still being set up on this workspace."; userError = 'config'; }
    else if (e instanceof AIError) {
      reply = e.info.code === 'TIMEOUT'
        ? "That took longer than expected — try asking a more specific question."
        : "I hit an error reaching the model. Please try again.";
      userError = e.info.code;
    } else { reply = "I hit an error. Please try again."; userError = 'unknown'; }
  }

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
  await db.update(schema.assistantSessions).set({ lastMessageAt: new Date() }).where(eq(schema.assistantSessions.id, session.id));

  return c.json({ reply, anonId, model, usedFallback, error: userError ?? undefined, toolCalls: toolCalls.map(t => ({ name: t.name, ok: t.ok })) });
});

export default app;
