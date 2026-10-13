import { Hono } from 'hono';
import { eq, or } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { makeKey, publicUrlFor, validateUpload, limits } from '../lib/r2';
import { authAdmin } from '../lib/auth';
import type { Env } from '../env';
import { ApiError } from '../lib/errors';
import { writeAudit } from '../lib/audit';
import { v, shape } from '../lib/validate';

const app = new Hono<{ Bindings: Env }>();

/** Public metadata lookup for an item by id or r2Key. Does NOT serve bytes (see /files/media/:id). */
app.get('/item/:id', async (c) => {
  const env = c.env as Env;
  const id = c.req.param('id');
  const db = getDb(env);
  const [row] = await db.select().from(schema.media)
    .where(or(eq(schema.media.id, id), eq(schema.media.r2Key, id)))
    .limit(1);
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Media not found.' });
  // Only public metadata is returned without auth.
  if (row.visibility !== 'PUBLIC') {
    try { await authAdmin(c.req.raw, env); } catch { throw new ApiError({ code: 'NOT_FOUND', message: 'Media not found.' }); }
  }
  return c.json({ success: true, data: { item: row } });
});

async function handleUpload(c: any) {
  const env = c.env as Env;
  let auth;
  try { auth = await authAdmin(c.req.raw, env); }
  catch (e) {
    if (e instanceof ApiError) return c.json({ success: false, error: { code: e.code, message: e.message } }, e.status);
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } }, 401);
  }

  const bucket = env.ASSETS;
  if (!bucket) throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Storage not configured.' });

  const contentType = c.req.header('content-type') || 'application/octet-stream';
  const contentLengthStr = c.req.header('content-length');
  const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : null;
  const filename = (c.req.query('filename') || 'upload').slice(0, 120);
  const alt = (c.req.query('alt') || '').slice(0, 200);
  const visibility = (c.req.query('visibility') || 'PUBLIC').toUpperCase() === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
  const role = c.req.query('role') || null;
  const projectId = c.req.query('projectId') || null;
  const mimeErr = validateUpload(contentType, contentLength);
  if (mimeErr) throw new ApiError({ code: 'UNSUPPORTED_MEDIA_TYPE', message: mimeErr });

  const key = makeKey(visibility === 'PRIVATE' && projectId ? `projects/${projectId}` : 'uploads', filename);
  const body = await c.req.raw.arrayBuffer();
  if (body.byteLength > limits.maxBytes) throw new ApiError({ code: 'PAYLOAD_TOO_LARGE', message: 'File too large.' });

  await bucket.put(key, body, { httpMetadata: { contentType } });
  const publicUrl = visibility === 'PUBLIC' ? publicUrlFor(env, key) : '';
  const db = getDb(env);
  const [media] = await db.insert(schema.media).values({
    filename, r2Key: key, publicUrl, mimeType: contentType, sizeBytes: body.byteLength,
    alt: alt || null, visibility,
    role,
    projectId: visibility === 'PRIVATE' && projectId ? projectId : null,
    uploadedBy: auth.uid,
  }).returning();

  writeAudit(env, { action: 'FILE_UPLOAD', entity: 'media', entityId: media.id, auth, req: c.req.raw, meta: { sizeBytes: body.byteLength, visibility, mimeType: contentType } });

  return c.json({ success: true, data: { item: media, publicUrl } }, 201);
}

app.post('/upload', handleUpload);
app.put('/upload', handleUpload);

export default app;
