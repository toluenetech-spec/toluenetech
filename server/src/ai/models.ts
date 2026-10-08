/**
 * Model routing for Dahl Inference.
 *
 * Phase 5 routing policy:
 *   Primary: deepseek-ai/DeepSeek-V4-Flash-0731  (fast, tool-capable, cheap)
 *   Fallback: zai-org/GLM-5.3-Flash              (fast + tool capable)
 *
 * MiniMax-M2.7 remains in the catalog for explicit admin selection but is
 * NEVER auto-escalated to from primary (prevents surprise reasoning-model cost).
 *
 * Verified available models (Dahl docs + dashboard, Oct 2026):
 *   - deepseek-ai/DeepSeek-V4-Flash-0731  : primary (all surfaces); tools OK
 *   - zai-org/GLM-5.3-Flash               : fallback (all surfaces); tools OK
 *   - MiniMaxAI/MiniMax-M2.7              : available but manual-select only
 *
 * Retired / NOT available:
 *   - moonshotai/Kimi-K2.6  — RETIRED on Dahl; DO NOT USE.
 *   - zai-org/GLM-5.2-FP8   — RETIRED.
 *   - Qwen/Qwen3.8-Flash-Next — not yet serving.
 *
 * Fallback on any error/timeout/empty: primary → GLM-5.3-Flash.
 * If GLM also fails → user-facing graceful error (no MiniMax auto-escalation).
 */

export type TaskTier = 'fast' | 'standard' | 'reasoning';

export interface ModelConfig {
  id: string;
  label: string;
  contextWindow: number;
  maxOutput: number;
  temperature: number;
  /** Whether this model reliably supports tools/function calling on Dahl. */
  tools: boolean;
  /** Whether this model emits <think> / <thinking> / <|begin_of_thought|> blocks. */
  emitsThinking: boolean;
}

export const MODEL_CATALOG: Record<string, ModelConfig> = {
  'deepseek-ai/DeepSeek-V4-Flash-0731': {
    id: 'deepseek-ai/DeepSeek-V4-Flash-0731',
    label: 'deepseek-v4-flash',
    contextWindow: 400_000,
    maxOutput: 600,
    temperature: 0.45,
    tools: true, // DeepSeek V4 Flash supports tools on Dahl
    emitsThinking: false,
  },
  'MiniMaxAI/MiniMax-M2.7': {
    id: 'MiniMaxAI/MiniMax-M2.7',
    label: 'minimax-m2.7',
    contextWindow: 180_000,
    maxOutput: 900,
    temperature: 0.35,
    tools: true,
    emitsThinking: false,
  },
  'zai-org/GLM-5.3-Flash': {
    id: 'zai-org/GLM-5.3-Flash',
    label: 'glm-5.3-flash',
    contextWindow: 400_000,
    maxOutput: 900,
    temperature: 0.45,
    tools: true, // GLM-5.3-Flash supports function calling (OpenAI-compatible schema)
    emitsThinking: true, // GLM thinking is always-on; strip it
  },
};

export function pickModel(env: {
  AI_MODEL?: string;
  AI_MODEL_PUBLIC?: string;
  AI_MODEL_REASONING?: string;
  AI_MODEL_FALLBACK?: string;
}, tier: TaskTier): string {
  let explicit: string | undefined;
  if (tier === 'fast') explicit = env.AI_MODEL_PUBLIC;
  else if (tier === 'reasoning') explicit = env.AI_MODEL_REASONING ?? env.AI_MODEL;
  else explicit = env.AI_MODEL;
  if (explicit) return explicit;
  switch (tier) {
    case 'fast':      return 'deepseek-ai/DeepSeek-V4-Flash-0731';
    case 'standard':  return 'deepseek-ai/DeepSeek-V4-Flash-0731';
    case 'reasoning': return 'deepseek-ai/DeepSeek-V4-Flash-0731';
  }
}

/**
 * Fallback chain: [primary, GLM].
 * MiniMax is deliberately excluded from auto-fallback; admins may still pick it
 * explicitly via AI_MODEL / AI_MODEL_REASONING / AI_MODEL_PUBLIC overrides.
 */
export function fallbackChain(env: { AI_MODEL_FALLBACK?: string }, primaryId: string): string[] {
  // Never auto-fallback to MiniMax.
  const fb = env.AI_MODEL_FALLBACK;
  const fallback = (fb && !/minimax/i.test(fb)) ? fb : 'zai-org/GLM-5.3-Flash';
  const ordered: string[] = [primaryId];
  if (fallback && fallback !== primaryId) ordered.push(fallback);
  return ordered;
}

export function getModelConfig(id: string): ModelConfig {
  return MODEL_CATALOG[id] ?? {
    id, label: id, contextWindow: 128_000, maxOutput: 600,
    temperature: 0.4, tools: false, emitsThinking: false,
  };
}

/** Aliases / historical names we want to normalise to avoid 400s from Dahl. */
export function normaliseModelId(id: string): string {
  const m: Record<string, string> = {
    'DeepSeek-V4-Flash': 'deepseek-ai/DeepSeek-V4-Flash-0731',
    'deepseek-v4-flash': 'deepseek-ai/DeepSeek-V4-Flash-0731',
    'DeepSeek-V4-Flash-0731': 'deepseek-ai/DeepSeek-V4-Flash-0731',
    'deepseek-ai/DeepSeek-V4-Flash': 'deepseek-ai/DeepSeek-V4-Flash-0731',
    'glm-5.3-flash': 'zai-org/GLM-5.3-Flash',
    'GLM-5.3-Flash': 'zai-org/GLM-5.3-Flash',
    'zai-org/glm-5.3-flash': 'zai-org/GLM-5.3-Flash',
    'MiniMax-M2.7': 'MiniMaxAI/MiniMax-M2.7',
    'minimax-m2.7': 'MiniMaxAI/MiniMax-M2.7',
  };
  return m[id] ?? id;
}
