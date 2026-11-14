import { Hono } from 'hono';
import { cors, resolveAllowedOrigins } from './lib/cors';
import { securityHeaders } from './lib/security';
import { jsonError, ApiError } from './lib/errors';
import type { Env } from './env';

import health from './routes/health';
import analytics from './routes/analytics';
import cms from './routes/cms';
import assistant from './routes/assistant';
import assistantAdmin from './routes/assistant-admin';
import assistantClient from './routes/assistant-client';
import aiLab from './routes/ai-lab';
import leads from './routes/leads';
import media from './routes/media';
import files from './routes/files';
import auth from './routes/auth';
import clientRoutes from './routes/client';
import payments from './routes/payments';
import admin from './routes/admin';
import adminPing from './routes/admin-ping';

const app = new Hono<{ Bindings: Env }>();

// Global CORS — origins resolved once per isolate from env (or defaults).
// In production CORS_ORIGIN should pin to the custom domain(s) explicitly.
app.use('*', async (c, next) => {
  const env = c.env as Env;
  const isDev = (env.DEV_MODE ?? 'false').toLowerCase() === 'true';
  const origins = resolveAllowedOrigins(env.CORS_ORIGIN, isDev);
  return cors(origins)(c, next);
});
// Security headers (HSTS, CSP, X-Content-Type-Options, etc.)
app.use('*', securityHeaders);

// Request ID for tracing.
app.use('*', async (c, next) => {
  const rid = crypto.randomUUID().slice(0, 8);
  c.header('X-Request-Id', rid);
  await next();
});

// Global error envelope.
app.onError((err, c) => jsonError(c, err));

app.route('/healthz', health);
app.route('/analytics', analytics);
app.route('/cms', cms);
app.route('/assistant', assistant);
app.route('/assistant/admin', assistantAdmin);
app.route('/assistant/client', assistantClient);
app.route('/ai-lab', aiLab);
app.route('/leads', leads);
app.route('/media', media);
app.route('/files', files);
app.route('/auth', auth);
app.route('/client', clientRoutes);
app.route('/payments', payments);

// Admin (auth-protected). Mount /admin/_ping before the wildcard auth gate
// so the UI can do a lightweight reachability check without a password.
app.route('/admin/_ping', adminPing);
app.route('/admin', admin);

app.all('*', () => { throw new ApiError({ code: 'NOT_FOUND', message: 'Endpoint not found.' }); });

export default app;
