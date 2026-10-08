/**
 * Client-portal API (JWT-protected).
 *
 * All endpoints:
 *   1. Verify JWT (requireClient).
 *   2. Verify the requested resource actually belongs to that client
 *      (assertProjectOwnership / clientId filter on every query).
 *   3. Never accept clientId/projectId from the request body for
 *      authorization — always derive from the token.
 */
import { Hono } from 'hono';
import { eq, desc, asc, and, isNull, sql, count } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';
import { authClient, assertProjectOwnership, type AuthContext } from '../lib/auth';
import { ApiError, jsonError } from '../lib/errors';
import { writeAudit } from '../lib/audit';
import { makeKey, publicUrlFor, validateUpload, limits } from '../lib/r2';
import { signedGetUrl } from '../lib/r2';


const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  try { (c as any).set('auth', await authClient(c.req.raw, c.env as Env)); }
  catch (e) {
    if (e instanceof ApiError) return c.json({ success: false, error: { code: e.code, message: e.message } }, e.status as any);
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401 as any);
  }
  await next();
});
app.onError((err, c) => jsonError(c, err));

function auth(c: any): AuthContext { return c.get('auth') as AuthContext; }
function cid(c: any): string { return auth(c).clientId as string; }
const uid = () => crypto.randomUUID();
const now = () => new Date();

app.get('/me', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const [row] = await db.select().from(schema.clients).where(eq(schema.clients.id, cid(c))).limit(1);
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Client not found.' });
  return c.json({
    success: true,
    data: { id: row.id, name: row.name, email: row.email, company: row.company, phone: row.phone, status: row.status },
  });
});

// ---------- Dashboard ----------
app.get('/dashboard', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const [projects, unread, outstandingInvs, openMs, recentMsg] = await Promise.all([
    db.select().from(schema.clientProjects)
      .where(and(eq(schema.clientProjects.clientId, cid(c)), isNull(schema.clientProjects.archivedAt)))
      .orderBy(desc(schema.clientProjects.createdAt)),
    db.select({ c: count() }).from(schema.notifications)
      .where(and(eq(schema.notifications.clientId, cid(c)), eq(schema.notifications.isRead, false))),
    db.select({ c: count() }).from(schema.invoices)
      .where(and(eq(schema.invoices.clientId, cid(c)),
        sql`${schema.invoices.status} IN ('SENT','VIEWED','PARTIALLY_PAID','OVERDUE')`)),
    db.select({ c: count() }).from(schema.milestones)
      .leftJoin(schema.clientProjects, eq(schema.milestones.projectId, schema.clientProjects.id))
      .where(and(eq(schema.clientProjects.clientId, cid(c)),
        sql`${schema.milestones.status} IN ('PENDING','IN_PROGRESS')`)),
    db.select().from(schema.messages)
      .leftJoin(schema.clientProjects, and(
        eq(schema.messages.contextType, 'PROJECT'),
        eq(schema.messages.contextId, schema.clientProjects.id),
      ))
      .where(and(eq(schema.clientProjects.clientId, cid(c)), eq(schema.messages.isFromClient, false)))
      .orderBy(desc(schema.messages.createdAt)).limit(5),
  ]);
  const active = projects.filter((p: any) => ['IN_PROGRESS','ACTIVE','REVIEW'].includes(p.status as any)).length;
  const completed = projects.filter((p: any) => (p.status as any) === 'COMPLETED').length;
  const pendingActions = Number(unread[0].c) + Number(openMs[0].c);
  return c.json({
    success: true,
    data: {
      projects: { total: projects.length, active, completed },
      unreadNotifications: Number(unread[0].c),
      outstandingInvoices: Number(outstandingInvs[0].c),
      openMilestones: Number(openMs[0].c),
      pendingActions,
      recentMessages: recentMsg.map((r: any) => r.messages),
      projectsList: projects,
    },
  });
});

app.get('/projects', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const rows = await db.select().from(schema.clientProjects)
    .where(and(eq(schema.clientProjects.clientId, cid(c)), isNull(schema.clientProjects.archivedAt)))
    .orderBy(desc(schema.clientProjects.createdAt));
  return c.json({ success: true, data: { items: rows, total: rows.length } });
});

app.get('/projects/:id', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, cid(c), c.req.param('id'));
  return c.json({ success: true, data: { item: p } });
});

app.get('/projects/:id/tasks', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, cid(c), c.req.param('id'));
  const db = getDb(env);
  const items = await db.select().from(schema.tasks)
    .where(eq(schema.tasks.projectId, p.id))
    .orderBy(asc(schema.tasks.createdAt));
  return c.json({ success: true, data: { items, total: items.length } });
});

app.get('/projects/:id/milestones', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, cid(c), c.req.param('id'));
  const db = getDb(env);
  const items = await db.select().from(schema.milestones)
    .where(eq(schema.milestones.projectId, p.id))
    .orderBy(asc(schema.milestones.order));
  return c.json({ success: true, data: { items, total: items.length } });
});

// ---------- Milestone approval (client only) ----------
app.post('/projects/:id/milestones/:mid/approve', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, cid(c), c.req.param('id'));
  const db = getDb(env);
  const mid = c.req.param('mid');
  let b: any = {};
  try { b = await c.req.json(); } catch { /* body optional */ }
  const [m] = await db.select().from(schema.milestones).where(and(eq(schema.milestones.id, mid), eq(schema.milestones.projectId, p.id))).limit(1);
  if (!m) throw new ApiError({ code: 'NOT_FOUND', message: 'Milestone not found.' });
  if (m.status !== 'COMPLETED') throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Only COMPLETED milestones can be approved or rejected.' });
  const comment = typeof b.comment === 'string' ? b.comment.trim().slice(0, 2000) : null;
  const approved = b.approve !== false;
  const nextStatus = approved ? 'APPROVED' : 'REJECTED';
  const patch: any = { status: nextStatus as any, updatedAt: now() };
  if (approved) { patch.approvedAt = now(); patch.approvedBy = cid(c); patch.rejectionReason = null; }
  else { patch.approvedAt = null; patch.approvedBy = null; patch.rejectionReason = comment; }
  const [updated] = await db.update(schema.milestones).set(patch).where(eq(schema.milestones.id, mid)).returning();
  await db.insert(schema.milestoneApprovals).values({
    id: uid(), milestoneId: mid, projectId: p.id, clientId: cid(c),
    action: approved ? 'APPROVED' : 'REJECTED', comment,
    actorType: 'client', actorId: cid(c), actorName: a.name || a.email,
  });
  writeAudit(env, { action: approved ? 'MILESTONE_APPROVE' : 'MILESTONE_REJECT', entity: 'milestones', entityId: mid, auth: auth(c), req: c.req.raw, meta: { projectId: p.id, comment } });
  // Notify admin(s) via notifications table.
  await db.insert(schema.notifications).values({
    id: uid(),
    clientId: cid(c),
    type: approved ? 'milestone_approved' : 'milestone_rejected',
    title: `Milestone ${approved ? 'approved' : 'rejected'}: ${m.title}`,
    body: comment || `Client ${a.name || a.email} ${approved ? 'approved' : 'rejected'} milestone "${m.title}".`,
    link: `/admin/projects/${p.id}`,
  });
  return c.json({ success: true, data: { item: updated } });
});

app.get('/projects/:id/files', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, cid(c), c.req.param('id'));
  const db = getDb(env);
  const items = await db.select().from(schema.projectFiles)
    .where(and(eq(schema.projectFiles.projectId, p.id), isNull(schema.projectFiles.deletedAt)))
    .orderBy(desc(schema.projectFiles.createdAt));
  return c.json({ success: true, data: { items, total: items.length } });
});

// ---------- File upload (client) ----------
// Client uploads are scoped to their own project. Max 10 MB per file.
const CLIENT_MAX_BYTES = 10 * 1024 * 1024;
const CLIENT_ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
  'application/zip', 'text/plain', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
app.post('/projects/:id/files', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, cid(c), c.req.param('id'));
  const bucket = env.ASSETS;
  if (!bucket) throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Storage not configured.' });
  const contentType = (c.req.header('content-type') || 'application/octet-stream').split(';')[0].trim();
  const contentLengthStr = c.req.header('content-length');
  const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : null;
  const filename = (c.req.query('filename') || 'upload').slice(0, 160);
  const mimeErr = validateUpload(contentType, contentLength, { maxBytes: CLIENT_MAX_BYTES, allowed: CLIENT_ALLOWED });
  if (mimeErr) throw new ApiError({ code: 'UNSUPPORTED_MEDIA_TYPE', message: mimeErr });
  const key = makeKey(`projects/${p.id}/client`, filename);
  const body = await c.req.raw.arrayBuffer();
  if (body.byteLength > CLIENT_MAX_BYTES) throw new ApiError({ code: 'PAYLOAD_TOO_LARGE', message: 'File too large (max 10 MB).' });
  await bucket.put(key, body, { httpMetadata: { contentType } });
  const db = getDb(env);
  const [file] = await db.insert(schema.projectFiles).values({
    id: uid(), projectId: p.id, clientId: cid(c),
    uploadedBy: cid(c), uploadedByRole: 'client',
    filename, r2Key: key, sizeBytes: body.byteLength, mimeType: contentType,
    visibility: 'PRIVATE',
  }).returning();
  writeAudit(env, { action: 'FILE_UPLOAD', entity: 'project_files', entityId: file.id, auth: auth(c), req: c.req.raw, meta: { sizeBytes: body.byteLength, mimeType: contentType } });
  // Notify admin(s).
  await db.insert(schema.notifications).values({
    id: uid(), type: 'file_uploaded', title: `New file in "${p.title}"`,
    body: `${a.name || a.email} uploaded "${filename}".`,
    link: `/admin/projects/${p.id}?tab=files`, clientId: cid(c),
  });
  return c.json({ success: true, data: { item: file } }, 201);
});

// ---------- Signed download URL (client) — ownership verified before signing ----------
app.get('/files/:id/download-url', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const [file] = await db.select().from(schema.projectFiles).where(eq(schema.projectFiles.id, c.req.param('id'))).limit(1);
  if (!file || file.deletedAt) throw new ApiError({ code: 'NOT_FOUND', message: 'File not found.' });
  if (file.projectId) await assertProjectOwnership(env, cid(c), file.projectId);
  else if (file.clientId && file.clientId !== cid(c)) throw new ApiError({ code: 'NOT_FOUND', message: 'File not found.' });
  const bucketName = env.R2_BUCKET_NAME || 'assets';
  const signed = await signedGetUrl(env, bucketName, file.r2Key, 900);
  const fallbackUrl = `/files/project/${file.id}`;
  return c.json({ success: true, data: { url: signed || fallbackUrl, expiresIn: signed ? 900 : null } });
});

// ---------- Messages (two-way) ----------
app.get('/projects/:id/messages', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, cid(c), c.req.param('id'));
  const db = getDb(env);
  const items = await db.select().from(schema.messages)
    .where(and(
      eq(schema.messages.contextType, 'PROJECT'),
      eq(schema.messages.contextId, p.id),
      // client sees messages they sent or messages addressed to them (or general project messages).
      sql`(${schema.messages.toClientId} IS NULL OR ${schema.messages.toClientId} = ${cid(c)} OR ${schema.messages.fromClientId} = ${cid(c)})`,
    ))
    .orderBy(asc(schema.messages.createdAt));
  return c.json({ success: true, data: { items, total: items.length } });
});

app.post('/projects/:id/messages', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const p = await assertProjectOwnership(env, cid(c), c.req.param('id'));
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const body = typeof b.body === 'string' ? b.body.trim().slice(0, 4000) : '';
  if (!body) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Message body is required.' });
  const threadId = typeof b.threadId === 'string' && /^[0-9a-f-]{36}$/.test(b.threadId) ? b.threadId : uid();
  const attachments = Array.isArray(b.attachments)
    ? b.attachments.filter((x: any) => x && typeof x.filename === 'string' && typeof x.r2Key === 'string').slice(0, 10).map((x: any) => ({ filename: String(x.filename).slice(0, 200), r2Key: String(x.r2Key).slice(0, 500) }))
    : [];
  const db = getDb(env);
  const [row] = await db.insert(schema.messages).values({
    id: uid(),
    contextType: 'PROJECT', contextId: p.id, threadId,
    fromUid: null, fromClientId: cid(c), fromName: a.name || a.email,
    toUid: null, toClientId: null, toName: 'Team',
    isFromClient: true, body, attachments, isRead: false,
  }).returning();
  writeAudit(env, { action: 'MESSAGE_SEND', entity: 'messages', entityId: row.id, auth: auth(c), req: c.req.raw, meta: { projectId: p.id } });
  // Admin notification.
  await db.insert(schema.notifications).values({
    id: uid(), type: 'message_new',
    title: `New message in "${p.title}"`,
    body: body.slice(0, 200),
    link: `/admin/projects/${p.id}?tab=messages`, clientId: cid(c),
  });
  return c.json({ success: true, data: { item: row } }, 201);
});

// ---------- Invoices ----------
app.get('/invoices', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const items = await db.select().from(schema.invoices)
    .where(eq(schema.invoices.clientId, cid(c)))
    .orderBy(desc(schema.invoices.createdAt));
  return c.json({ success: true, data: { items, total: items.length } });
});
app.get('/invoices/:id', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, c.req.param('id'))).limit(1);
  if (!inv || inv.clientId !== cid(c)) throw new ApiError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
  const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, inv.id)).orderBy(asc(schema.invoiceItems.order));
  // Mark viewed if SENT.
  if (inv.status === 'SENT') {
    await db.update(schema.invoices).set({ status: 'VIEWED' as any, viewedAt: now() }).where(eq(schema.invoices.id, inv.id));
    inv.status = 'VIEWED'; inv.viewedAt = now();
    writeAudit(env, { action: 'INVOICE_VIEW', entity: 'invoices', entityId: inv.id, auth: auth(c), req: c.req.raw });
  }
  return c.json({ success: true, data: { item: inv, items } });
});

// ---------- Notifications ----------
app.get('/notifications', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const items = await db.select().from(schema.notifications)
    .where(eq(schema.notifications.clientId, cid(c)))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(100);
  const unread = items.filter((n: any) => !n.isRead).length;
  return c.json({ success: true, data: { items, total: items.length, unread } });
});
app.post('/notifications/:id/read', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  const [n] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, c.req.param('id'))).limit(1);
  if (!n || n.clientId !== cid(c)) throw new ApiError({ code: 'NOT_FOUND', message: 'Notification not found.' });
  await db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.id, n.id));
  writeAudit(env, { action: 'NOTIFICATION_READ', entity: 'notifications', entityId: n.id, auth: auth(c), req: c.req.raw });
  return c.json({ success: true, data: { ok: true } });
});
app.post('/notifications/read-all', async (c) => {
  const env = c.env as Env;
  const a = auth(c);
  const db = getDb(env);
  await db.update(schema.notifications).set({ isRead: true })
    .where(and(eq(schema.notifications.clientId, cid(c)), eq(schema.notifications.isRead, false)));
  return c.json({ success: true, data: { ok: true } });
});

export default app;
