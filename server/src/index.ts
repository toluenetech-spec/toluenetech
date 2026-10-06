import { Hono } from 'hono';
import { cors } from './lib/cors';
import type { Env } from './env';

import health from './routes/health';
import cms from './routes/cms';
import assistant from './routes/assistant';
import assistantAdmin from './routes/assistant-admin';
import assistantClient from './routes/assistant-client';
import leads from './routes/leads';
import media from './routes/media';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const originList = (c.env as Env).CORS_ORIGIN
    ?? 'http://localhost:5173,https://curious-sprinkles-59674e.netlify.app,https://toluenetech.com,https://*.netlify.app';
  return cors(originList)(c, next);
});

app.route('/healthz', health);
app.route('/cms', cms);
// Public assistant mounts at /assistant so its /session and /chat become
// /assistant/session and /assistant/chat. Admin/client are mounted at their
// own /assistant/admin and /assistant/client prefixes (chat-only).
app.route('/assistant', assistant);
app.route('/assistant/admin', assistantAdmin);
app.route('/assistant/client', assistantClient);
app.route('/leads', leads);
app.route('/media', media);

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default app;
