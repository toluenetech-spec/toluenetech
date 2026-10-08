/**
 * Client-portal API (JWT-protected).
 *
 * All endpoints:
 *   1. Verify JWT (requireClient).
 *   2. Verify the requested resource actually belongs to that client
 *      (assertProjectOwnership / clientId filter on every query).
 *   3. Never accept clientId/projectId from the request body for
 *      authorization — always derive from the token.
 *
 * These are READ endpoints in Phase 1; write endpoints (messages, file
 * uploads, milestone approval) land in Phase 2+ once the portal is rebuilt.
 */
import { Hono } from 'hono';
import { eq, desc, asc, and } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';
import { authClient, assertProjectOwnership } from '../lib/auth';
import { ApiError } from '../lib/errors';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  try { (c as any).set('auth', await authClient(c.req.raw, c.env as Env)); }
  catch (e) {
    if (e instanceof ApiError) return c.json({ success: false, error: { code: e.code, message: e.message } }, e.status as any);
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401 as any);
  }
  await next();
});

function auth(c: any) { return c.get('auth') as { clientId: string; uid: string; email: string; name?: string }; }

app.get('/me', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const [row] = await db.select().from(schema.clients).where(eq(schema.clients.id, a.clientId)).limit(1);
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Client not found.' });
  return c.json({
    success: true,
    data: { id: row.id, name: row.name, email: row.email, company: row.company, phone: row.phone, status: row.status },
  });
});

app.get('/projects', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const rows = await db.select().from(schema.clientProjects)
    .where(eq(schema.clientProjects.clientId, a.clientId))
    .orderBy(desc(schema.clientProjects.createdAt));
  return c.json({ success: true, data: { items: rows, total: rows.length } });
});

app.get('/projects/:id', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, a.clientId, c.req.param('id'));
  return c.json({ success: true, data: { item: p } });
});

app.get('/projects/:id/milestones', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, a.clientId, c.req.param('id'));
  const db = getDb(env);
  const items = await db.select().from(schema.milestones)
    .where(eq(schema.milestones.projectId, p.id))
    .orderBy(asc(schema.milestones.order));
  return c.json({ success: true, data: { items, total: items.length } });
});

app.get('/projects/:id/files', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, a.clientId, c.req.param('id'));
  const db = getDb(env);
  const items = await db.select().from(schema.projectFiles)
    .where(and(
      eq(schema.projectFiles.projectId, p.id),
      // Client can only see files that are not PRIVATE-internal (admin-only) —
      // currently all project files are visible to the owning client; we add
      // visibility filtering in Phase 2 if needed.
    ))
    .orderBy(desc(schema.projectFiles.createdAt));
  return c.json({ success: true, data: { items, total: items.length } });
});

app.get('/projects/:id/messages', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, a.clientId, c.req.param('id'));
  const db = getDb(env);
  const items = await db.select().from(schema.messages)
    .where(and(
      eq(schema.messages.contextType, 'PROJECT'),
      eq(schema.messages.contextId, p.id),
    ))
    .orderBy(asc(schema.messages.createdAt));
  return c.json({ success: true, data: { items, total: items.length } });
});

app.get('/invoices', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const items = await db.select().from(schema.invoices)
    .where(eq(schema.invoices.clientId, a.clientId))
    .orderBy(desc(schema.invoices.createdAt));
  return c.json({ success: true, data: { items, total: items.length } });
});

app.get('/notifications', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const items = await db.select().from(schema.notifications)
    .where(eq(schema.notifications.clientId, a.clientId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(100);
  return c.json({ success: true, data: { items, total: items.length } });
});

export default app;
