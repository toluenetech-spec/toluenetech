import { Hono } from 'hono';
import { cors } from './lib/cors';
import type { Env } from './env';

import health from './routes/health';
import cms from './routes/cms';
import assistant from './routes/assistant';
import assistantAdmin from './routes/assistant-admin';
import assistantClient from './routes/assistant-client';
import aiLab from './routes/ai-lab';
import leads from './routes/leads';
import media from './routes/media';
import admin from './routes/admin';
import adminPing from './routes/admin-ping';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const originList = (c.env as Env).CORS_ORIGIN
    ?? 'http://localhost:5173,https://curious-sprinkles-59674e.netlify.app,https://toluenetech.com,https://*.netlify.app';
  return cors(originList)(c, next);
});

app.route('/healthz', health);
app.route('/cms', cms);
app.route('/assistant', assistant);
app.route('/assistant/admin', assistantAdmin);
app.route('/assistant/client', assistantClient);
app.route('/ai-lab', aiLab);
app.route('/leads', leads);
app.route('/media', media);

// Admin (auth-protected). Mount /admin/_ping before the wildcard auth gate
// so the UI can do a lightweight reachability check without a password.
app.route('/admin/_ping', adminPing);
app.route('/admin', admin);

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default app;
