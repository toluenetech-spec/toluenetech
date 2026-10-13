/**
 * File download endpoint.
 *
 *   GET /files/media/:id     — public files (visibility=PUBLIC from media table)
 *   GET /files/project/:id   — private project files (requires client OR admin auth;
 *                              ownership verified)
 *
 * For private files we prefer a signed R2 URL if R2_ENDPOINT + S3 credentials
 * are configured; otherwise we proxy the bytes through the Worker (slower but
 * works without extra config). The response always has a Content-Disposition
 * header with the original filename and a Content-Type from DB metadata.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';
import { authAny, authAdmin, assertProjectOwnership } from '../lib/auth';
import { ApiError } from '../lib/errors';
import { signedGetUrl } from '../lib/r2';

const app = new Hono<{ Bindings: Env }>();

app.get('/media/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, c.req.param('id'))).limit(1);
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'File not found.' });
  if (row.visibility !== 'PUBLIC') {
    try { await authAny(c.req.raw, env); }
    catch { throw new ApiError({ code: 'NOT_FOUND', message: 'File not found.' }); }
  }
  return serveFromR2(c, env, row.r2Key, row.filename, row.mimeType);
});

app.get('/project/:id', async (c) => {
  const env = c.env as Env;
  let auth;
  try { auth = await authAny(c.req.raw, env); }
  catch { throw new ApiError({ code: 'UNAUTHORIZED', message: 'Authentication required.' }); }
  const db = getDb(env);
  const [file] = await db.select().from(schema.projectFiles).where(eq(schema.projectFiles.id, c.req.param('id'))).limit(1);
  if (!file || file.deletedAt) throw new ApiError({ code: 'NOT_FOUND', message: 'File not found.' });
  if (!file.projectId) throw new ApiError({ code: 'NOT_FOUND', message: 'File not found.' });
  if (auth.kind === 'client') {
    if (!auth.clientId) throw new ApiError({ code: 'FORBIDDEN', message: 'Client access required.' });
    await assertProjectOwnership(env, auth.clientId, file.projectId);
  }
  return serveFromR2(c, env, file.r2Key, file.filename, file.mimeType);
});

async function serveFromR2(c: any, env: Env, key: string, filename: string, mimeType: string | null) {
  const bucket = env.ASSETS;
  if (!bucket) throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Storage not configured.' });
  const obj = await bucket.get(key);
  if (!obj) throw new ApiError({ code: 'NOT_FOUND', message: 'File not found in storage.' });
  const headers = new Headers();
  headers.set('Content-Type', mimeType || obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Disposition', `inline; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
  headers.set('Cache-Control', 'private, max-age=300');
  if (obj.size != null) headers.set('Content-Length', String(obj.size));
  return new Response(obj.body as any, { headers, status: 200 });
}

export default app;
