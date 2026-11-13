import { Hono } from 'hono';
import type { Env } from '../env';
import { getAI, AIConfigError } from '../ai';

const app = new Hono<{ Bindings: Env }>();

function keyPreview(k: string | undefined) {
  if (!k) return null;
  return k.length > 10 ? (k.slice(0, 6) + '…' + k.slice(-4)) : '(set)';
}

app.get('/', async (c) => {
  const env = c.env as Env;
  const status: any = { ok: true, db: 'ok', ai: 'ready', version: '0.2.0', time: new Date().toISOString() };
  try {
    const { getDbAsync } = await import('../db');
    const db = await getDbAsync(env);
    await db.execute('select 1');
  } catch (e: any) {
    status.db = 'error'; status.db_error = String(e?.message || e).slice(0, 200); status.ok = false;
  }
  const hasThKey = !!(env.AI_TOKENHARBOR_KEY || env.AI_API_KEY);
  const hasDahlKey = !!env.AI_DAHL_KEY;
  status.ai_provider_env = env.AI_PROVIDER || '(unset, default tokenharbor)';
  status.ai_keys = {
    tokenharbor: { configured: hasThKey, prefix: keyPreview(env.AI_TOKENHARBOR_KEY || env.AI_API_KEY) },
    dahl: { configured: hasDahlKey, prefix: keyPreview(env.AI_DAHL_KEY) },
    legacy_api_key: { configured: !!env.AI_API_KEY, prefix: keyPreview(env.AI_API_KEY) },
  };
  try {
    getAI(env); // will throw if unconfigured
    status.ai = hasThKey && hasDahlKey ? 'ready (tokenharbor + dahl)'
      : hasThKey ? 'ready (tokenharbor)'
      : hasDahlKey ? 'ready (dahl)'
      : 'ready';
  } catch (e: any) {
    if (e instanceof AIConfigError) { status.ai = 'unconfigured'; status.ai_error = e.message; }
    else { status.ai = 'error'; status.ai_error = String(e?.message || e).slice(0, 300); }
  }
  return c.json(status);
});

/** Diagnostic — quick "ping" to the default (TH free) model. Public but hidden; returns raw provider error. */
app.get('/ai-ping', async (c) => {
  const env = c.env as Env;
  try {
    const ai = getAI(env);
    const start = Date.now();
    const res = await ai.run(
      { model: 'deepseek-v4.1-flash:free', messages: [{ role: 'user', content: 'Reply with the single word: pong' }], maxTokens: 20, tier: 'fast', timeoutMs: 15_000 } as any,
      {},
      { kind: 'public' } as any,
    );
    return c.json({ ok: true, latency_ms: Date.now() - start, reply: (res?.content || '').slice(0, 200), model: res?.model, usedFallback: res?.usedFallback });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message || e).slice(0, 800), name: e?.name }, 500);
  }
});

export default app;
// trigger Fri Nov 13 21:23:58 UTC 2026
