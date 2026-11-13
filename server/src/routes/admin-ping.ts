import { Hono } from 'hono';
import type { Env } from '../env';
import { getDb } from '../db';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  try { await db.execute('select 1'); } catch { return c.json({ ok: false, db: 'error' }, 503); }
  return c.json({ ok: true });
});

export default app;
