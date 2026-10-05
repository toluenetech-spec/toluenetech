import { Hono } from 'hono';
import type { Env } from '../env';
import { getAIProvider, AIConfigError } from '../ai';
import { getDb } from '../db';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  const env = c.env as Env;
  const status: { ok: boolean; db: 'ok' | 'error'; ai: 'ready' | 'unconfigured' | 'error'; version: string; time: string } = {
    ok: true, db: 'ok', ai: 'ready', version: '0.1.0', time: new Date().toISOString(),
  };
  try {
    const db = getDb(env);
    await db.execute('select 1');
  } catch {
    status.db = 'error'; status.ok = false;
  }
  try { getAIProvider(env); }
  catch (e) { if (e instanceof AIConfigError) status.ai = 'unconfigured'; else status.ai = 'error'; }
  return c.json(status);
});

export default app;
