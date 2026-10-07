import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { AIConfigError, getAI } from '../ai';
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

/** For the demo client, surface demo project data so the assistant isn't empty.
 *  Other clients read from Neon. */
const DEMO_PROJECTS = [{
  id: 'cp-demo-1', title: 'Company Website Redesign', status: 'ACTIVE' as const, progress: 55,
  startDate: new Date('2026-08-01'), dueDate: new Date('2026-10-15'),
}];
const DEMO_MILESTONES = [
  { id: 'ms-1', projectId: 'cp-demo-1', title: 'Discovery & Sitemap', status: 'COMPLETED' as const, order: 1 },
  { id: 'ms-2', projectId: 'cp-demo-1', title: 'Wireframes & Design', status: 'COMPLETED' as const, order: 2 },
  { id: 'ms-3', projectId: 'cp-demo-1', title: 'Development', status: 'IN_PROGRESS' as const, order: 3, dueDate: new Date('2026-09-30') },
  { id: 'ms-4', projectId: 'cp-demo-1', title: 'QA & Launch', status: 'PENDING' as const, order: 4, dueDate: new Date('2026-10-15') },
];
const DEMO_MESSAGES = [{
  id: 'm-demo-1', fromName: 'Toluene Tech', body: "Welcome to your portal! You can track progress, review files, and ask me questions about your project here.",
  createdAt: new Date('2026-09-01'),
}];

async function ensureDemoClient(db: ReturnType<typeof getDb>) {
  // Make sure demo records exist in Neon so tools return real rows.
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
    for (const m of DEMO_MESSAGES) await db.insert(schema.messages).values({
      contextType: 'PROJECT', contextId: 'cp-demo-1', fromUid: null,
      fromName: m.fromName, body: m.body, isRead: true,
    } as any).onConflictDoNothing();
  }
}

app.post('/', async (c) => {
  const env = c.env as Env;
  let auth;
  try { auth = await authClient(c.req.raw, env); } catch { return c.json({ error: 'Unauthorized' }, 401); }

  const ip = clientIp(c.req.raw, env as unknown as Record<string,string|undefined>);
  const rl = rateLimit(`client-chat:${auth.uid}:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) return c.json({ error: 'Rate limit exceeded' }, 429);

  let body: { message?: unknown; anonId?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const message = sanitize(body.message);
  if (!message) return c.json({ error: 'Empty message' }, 400);

  const db = getDb(env);

  if (auth.clientId === 'client-demo') await ensureDemoClient(db);

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

  // Load the client's projects list (id+title only) to ground the intro
  const clientProjects = auth.clientId === 'client-demo'
    ? await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.clientId, 'client-demo'))
    : await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.clientId, auth.clientId!));
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
  try {
    const ai = getAI(env);
    const r = await ai.run(
      {
        messages,
        tier: 'reasoning',
        tools: CLIENT_TOOLS,
        maxTurns: 5,
        maxTokens: 800,
        timeoutMs: 25_000,
      },
      buildHandlers({ kind: 'client', auth: { uid: auth.uid, email: auth.email, name: auth.name, clientId: auth.clientId }, db, env, ip }),
      { kind: 'client', auth: { uid: auth.uid, email: auth.email, name: auth.name, clientId: auth.clientId }, db, env, ip },
    );
    reply = r.content;
    toolCalls = r.toolCalls;
    model = r.model;
  } catch (e) {
    if (e instanceof AIConfigError) {
      reply = "Tolesh is still being set up on this workspace.";
    } else {
      reply = "I hit an error reaching the model — please try again in a moment.";
    }
  }

  await db.insert(schema.assistantMessages).values({ sessionId: session.id, role: 'assistant', content: reply });
  await db.update(schema.assistantSessions).set({ lastMessageAt: new Date() }).where(eq(schema.assistantSessions.id, session.id));

  return c.json({ reply, anonId, model, toolCalls: toolCalls.map(t => ({ name: t.name, ok: t.ok })) });
});

export default app;
