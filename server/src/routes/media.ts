import { Hono } from 'hono';
import { eq, or } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { makeKey, publicUrlFor, validateUpload, limits } from '../lib/r2';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/item/:id', async (c) => {
  const env = c.env as Env;
  const id = c.req.param('id');
  const db = getDb(env);
  const [row] = await db.select().from(schema.media)
    .where(or(eq(schema.media.id, id), eq(schema.media.r2Key, id)))
    .limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ item: row });
});

/** Admin upload (auth middleware added in later phase). */
async function handleUpload(c: any) {
  const env = c.env as Env;
  const bucket = env.ASSETS;
  if (!bucket) return c.json({ error: 'Storage not configured' }, 500);

  const contentType = c.req.header('content-type') || 'application/octet-stream';
  const contentLengthStr = c.req.header('content-length');
  const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : null;
  const filename = (c.req.query('filename') || 'upload').slice(0, 120);
  const mimeErr = validateUpload(contentType, contentLength);
  if (mimeErr) return c.json({ error: mimeErr }, 400);

  const key = makeKey('uploads', filename);
  const body = await c.req.raw.arrayBuffer();
  if (body.byteLength > limits.maxBytes) return c.json({ error: 'File too large.' }, 400);

  await bucket.put(key, body, { httpMetadata: { contentType } });
  const publicUrl = publicUrlFor(env, key);
  const db = getDb(env);
  const [media] = await db.insert(schema.media).values({
    filename, r2Key: key, publicUrl, mimeType: contentType, sizeBytes: body.byteLength,
  }).returning();

  return c.json({ ok: true, item: media, publicUrl }, 201);
}

app.post('/upload', handleUpload);
app.put('/upload', handleUpload);

export default app;
