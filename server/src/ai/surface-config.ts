/**
 * Resolve model+fallback per surface from env vars.
 *
 * Surfaces: public | admin | client | planner | advisor | idea
 *
 * Each surface reads:
 *   AI_MODEL_<SURFACE>          primary override
 *   AI_MODEL_FALLBACK_<SURFACE> fallback override
 *   AI_FALLBACK_<SURFACE>_ENABLED   "true" | "false" (default true)
 *
 * Falls back to the tier defaults (models.pickModel) when not specified.
 */
import type { Env } from '../env';
import { fallbackChain as defaultChain, pickModel, normaliseModelId, type TaskTier } from './models';

export type Surface = 'public' | 'admin' | 'client' | 'planner' | 'advisor' | 'idea';

const SURF_ENV: Record<Surface, { primary: string; fallback: string; enabled: string; tier: TaskTier }> = {
  public:  { primary: 'AI_MODEL_PUBLIC',   fallback: 'AI_MODEL_FALLBACK_PUBLIC',  enabled: 'AI_FALLBACK_PUBLIC_ENABLED',  tier: 'fast' },
  planner: { primary: 'AI_MODEL_PLANNER',  fallback: 'AI_MODEL_FALLBACK_PLANNER', enabled: 'AI_FALLBACK_PLANNER_ENABLED', tier: 'fast' },
  idea:    { primary: 'AI_MODEL_IDEA',     fallback: 'AI_MODEL_FALLBACK_IDEA',    enabled: 'AI_FALLBACK_IDEA_ENABLED',    tier: 'fast' },
  admin:   { primary: 'AI_MODEL_REASONING' /* or AI_MODEL */, fallback: 'AI_MODEL_FALLBACK_ADMIN',  enabled: 'AI_FALLBACK_ADMIN_ENABLED',  tier: 'reasoning' },
  client:  { primary: 'AI_MODEL_CLIENT',   fallback: 'AI_MODEL_FALLBACK_CLIENT',  enabled: 'AI_FALLBACK_CLIENT_ENABLED',  tier: 'reasoning' },
  advisor: { primary: 'AI_MODEL_ADVISOR',  fallback: 'AI_MODEL_FALLBACK_ADVISOR', enabled: 'AI_FALLBACK_ADVISOR_ENABLED', tier: 'reasoning' },
};

function envGet(env: Env, k: string): string | undefined {
  return (env as unknown as Record<string, string | undefined>)[k];
}

export function resolveForSurface(env: Env, surface: Surface): { primary: string; fallbackChain: string[]; tier: TaskTier } {
  const cfg = SURF_ENV[surface];
  let primary: string;
  if (surface === 'admin') {
    primary = envGet(env, 'AI_MODEL_ADMIN') ?? envGet(env, cfg.primary) ?? envGet(env, 'AI_MODEL') ?? pickModel(env as any, cfg.tier);
  } else {
    primary = envGet(env, cfg.primary) ?? pickModel(env as any, cfg.tier);
  }
  primary = normaliseModelId(primary);

  const fallbackEnabledRaw = envGet(env, cfg.enabled);
  const fallbackEnabled = fallbackEnabledRaw === undefined ? true : fallbackEnabledRaw === 'true';
  const explicitFb = envGet(env, cfg.fallback) ?? envGet(env, 'AI_MODEL_FALLBACK');

  let fb: string | null = null;
  if (fallbackEnabled) fb = normaliseModelId(explicitFb ?? 'zai-org/GLM-5.3-Flash');
  const chain = [primary];
  if (fb && fb !== primary) chain.push(fb);
  return { primary, fallbackChain: chain, tier: cfg.tier };
}
