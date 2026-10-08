/**
 * Resolve model+fallback+per-surface options per surface.
 *
 * Configuration layers, in priority order (highest first):
 *   1. Database-staged ai_config (site_settings row key='ai_config') — set by
 *      Admin AI Model Control. Cached in-memory per isolate for CONFIG_TTL_MS
 *      to avoid a DB round-trip on every request. A successful POST to
 *      /admin/ai/config invalidates the cache globally via invalidateCache().
 *   2. Environment variables (AI_MODEL_*). These are the deployment baseline.
 *   3. Hardcoded defaults per surface (tier-based).
 *
 * Each surface returns:
 *   primary: string
 *   fallbackChain: string[]   (primary + fallback if fallbackEnabled)
 *   tier: 'fast' | 'reasoning'
 *   timeoutMs: number
 *   maxTokens: number
 *   toolsEnabled?: string[]    // optional whitelist; undefined = surface default
 */
import type { Env } from '../env';
import { getDb, schema } from '../db';
import { eq } from 'drizzle-orm';
import { pickModel, normaliseModelId, type TaskTier } from './models';

export type Surface = 'public' | 'admin' | 'client' | 'planner' | 'advisor' | 'idea';

const SURF_ENV: Record<Surface, { primary: string; fallback: string; enabled: string; tier: TaskTier }> = {
  public:  { primary: 'AI_MODEL_PUBLIC',   fallback: 'AI_MODEL_FALLBACK_PUBLIC',  enabled: 'AI_FALLBACK_PUBLIC_ENABLED',  tier: 'fast' },
  planner: { primary: 'AI_MODEL_PLANNER',  fallback: 'AI_MODEL_FALLBACK_PLANNER', enabled: 'AI_FALLBACK_PLANNER_ENABLED', tier: 'fast' },
  idea:    { primary: 'AI_MODEL_IDEA',     fallback: 'AI_MODEL_FALLBACK_IDEA',    enabled: 'AI_FALLBACK_IDEA_ENABLED',    tier: 'fast' },
  admin:   { primary: 'AI_MODEL_REASONING', fallback: 'AI_MODEL_FALLBACK_ADMIN', enabled: 'AI_FALLBACK_ADMIN_ENABLED',  tier: 'reasoning' },
  client:  { primary: 'AI_MODEL_CLIENT',   fallback: 'AI_MODEL_FALLBACK_CLIENT',  enabled: 'AI_FALLBACK_CLIENT_ENABLED',  tier: 'reasoning' },
  advisor: { primary: 'AI_MODEL_ADVISOR',  fallback: 'AI_MODEL_FALLBACK_ADVISOR', enabled: 'AI_FALLBACK_ADVISOR_ENABLED', tier: 'reasoning' },
};

// Production defaults — Public Tolesh stays fast (DeepSeek V4 Flash) with
// GLM-5.3-Flash as fallback ONLY when DeepSeek genuinely fails. MiniMax is
// never an auto-escalation path for ordinary public chat.
const DEFAULTS: Record<Surface, { primary: string; fallback: string; timeoutMs: number; maxTokens: number }> = {
  public:  { primary: 'deepseek-ai/DeepSeek-V4-Flash-0731', fallback: 'zai-org/GLM-5.3-Flash', timeoutMs: 25_000, maxTokens: 900 },
  planner: { primary: 'deepseek-ai/DeepSeek-V4-Flash-0731', fallback: 'zai-org/GLM-5.3-Flash', timeoutMs: 40_000, maxTokens: 1500 },
  idea:    { primary: 'deepseek-ai/DeepSeek-V4-Flash-0731', fallback: 'zai-org/GLM-5.3-Flash', timeoutMs: 25_000, maxTokens: 900 },
  admin:   { primary: 'MiniMaxAI/MiniMax-M2.7',             fallback: 'zai-org/GLM-5.3-Flash', timeoutMs: 45_000, maxTokens: 1200 },
  client:  { primary: 'MiniMaxAI/MiniMax-M2.7',             fallback: 'zai-org/GLM-5.3-Flash', timeoutMs: 30_000, maxTokens: 1000 },
  advisor: { primary: 'MiniMaxAI/MiniMax-M2.7',             fallback: 'zai-org/GLM-5.3-Flash', timeoutMs: 30_000, maxTokens: 1000 },
};

function envGet(env: Env, k: string): string | undefined {
  return (env as unknown as Record<string, string | undefined>)[k];
}

export interface SurfaceConfig {
  primary: string;
  fallbackChain: string[];
  tier: TaskTier;
  timeoutMs: number;
  maxTokens: number;
  toolsEnabled?: string[];
}

// In-memory cache per Worker isolate. See invalidateCache() — after saving
// config via /admin/ai/config we invalidate immediately. Between isolates
// the cache refreshes within CONFIG_TTL_MS anyway.
const CONFIG_TTL_MS = 30_000;
let dbCache: { loadedAt: number; value: Record<string, any> | null } | null = null;

export function invalidateCache() { dbCache = null; }

async function loadDbConfig(env: Env): Promise<Record<string, any> | null> {
  if (dbCache && Date.now() - dbCache.loadedAt < CONFIG_TTL_MS) return dbCache.value;
  try {
    const db = getDb(env);
    const [row] = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, 'ai_config')).limit(1);
    const val = row?.value ?? null;
    dbCache = { loadedAt: Date.now(), value: val && typeof val === 'object' ? val : null };
    return dbCache.value;
  } catch {
    return null; // DB failure → fall back to env/defaults.
  }
}

export async function resolveForSurface(env: Env, surface: Surface): Promise<SurfaceConfig> {
  const cfg = SURF_ENV[surface];
  const def = DEFAULTS[surface];
  const dbCfg = (await loadDbConfig(env))?.[surface] as any || {};

  // Primary: DB → env → default.
  let primary: string;
  if (dbCfg.primary && typeof dbCfg.primary === 'string') {
    primary = normaliseModelId(dbCfg.primary);
  } else if (surface === 'admin') {
    primary = normaliseModelId(envGet(env, 'AI_MODEL_ADMIN') ?? envGet(env, cfg.primary) ?? envGet(env, 'AI_MODEL') ?? def.primary);
  } else {
    primary = normaliseModelId(envGet(env, cfg.primary) ?? def.primary);
  }

  // Fallback: env/DB/default gated by fallbackEnabled.
  const fallbackEnabledRaw = envGet(env, cfg.enabled);
  const envFbEnabled = fallbackEnabledRaw === undefined ? true : fallbackEnabledRaw === 'true';
  const dbFbEnabled = typeof dbCfg.fallbackEnabled === 'boolean' ? dbCfg.fallbackEnabled : envFbEnabled;
  let fb: string | null = null;
  if (dbFbEnabled) {
    const fbSrc = dbCfg.fallback ?? envGet(env, cfg.fallback) ?? envGet(env, 'AI_MODEL_FALLBACK') ?? def.fallback;
    fb = normaliseModelId(fbSrc);
    if (fb === primary) fb = null;
  }
  const fallbackChain = fb ? [primary, fb] : [primary];

  const timeoutMs = typeof dbCfg.timeoutMs === 'number' ? Math.max(5000, Math.min(120000, dbCfg.timeoutMs)) : def.timeoutMs;
  const maxTokens = typeof dbCfg.maxTokens === 'number' ? Math.max(100, Math.min(8000, dbCfg.maxTokens)) : def.maxTokens;
  const toolsEnabled = Array.isArray(dbCfg.toolsEnabled) ? dbCfg.toolsEnabled.filter((x: any) => typeof x === 'string') : undefined;

  return { primary, fallbackChain, tier: cfg.tier, timeoutMs, maxTokens, toolsEnabled };
}

/**
 * Build the admin-facing representation (for GET /admin/ai/config). Returns
 * effective (active) config, DB-staged overrides, and env baseline.
 */
export async function buildConfigSnapshot(env: Env) {
  const dbCfg = await loadDbConfig(env);
  const surfaces: Record<string, { primary: string; fallback: string | null; fallbackEnabled: boolean; tier: TaskTier; timeoutMs: number; maxTokens: number; toolsEnabled?: string[] }> = {};
  for (const s of Object.keys(SURF_ENV) as Surface[]) {
    const cfg = await resolveForSurface(env, s);
    surfaces[s] = {
      primary: cfg.primary,
      fallback: cfg.fallbackChain[1] ?? null,
      fallbackEnabled: cfg.fallbackChain.length > 1,
      tier: cfg.tier,
      timeoutMs: cfg.timeoutMs,
      maxTokens: cfg.maxTokens,
      toolsEnabled: cfg.toolsEnabled,
    };
  }
  return { surfaces, staged: dbCfg ?? null };
}
