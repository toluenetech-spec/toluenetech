/**
 * Model routing — Token Harbor era (Nov 2026).
 *
 * Primary provider: Token Harbor (https://tokenharbor.ai/v1)
 *   - Base URL: https://tokenharbor.ai/v1 (OpenAI-compatible)
 *   - Supports tools/function calling natively on recent models.
 *
 * Primary model (default):
 *   deepseek-v4.1-flash:free  — DeepSeek V4.1 Flash (MIMO), free tier.
 *   Paid route: deepseek-v4.1-flash (set as AI_MODEL to switch; requires credits).
 *
 * Fallback chain (in order) on any error/timeout/empty/429 — uses free-tier models
 * when on the $0 balance plan; paid models (GLM/MiniMax) are auto-skipped because
 * they return 402 Payment Required without credits and just waste a fallback attempt.
 *   1. deepseek-v4-flash:free    (DeepSeek V4 Flash 0731 — stable dual)
 *   2. mimo-v2.6-flash:free      (Xiaomi MiMo V2.6 Flash — fast free tier)
 *
 * Paid models available on Token Harbor when credits added:
 *   zai/glm-5.3-flash, MiniMaxAI/MiniMax-M2.7, anthropic/claude-*, etc.
 * Set AI_MODEL_FALLBACK="zai/glm-5.3-flash,MiniMaxAI/MiniMax-M2.7" to enable
 * them, or switch primary to paid IDs by setting AI_MODEL (no :free suffix).
 *
 * Dahl provider is kept as a legacy option (set AI_PROVIDER=dahl to switch back).
 */

export type TaskTier = 'fast' | 'standard' | 'reasoning';

export interface ModelConfig {
  id: string;
  label: string;
  contextWindow: number;
  maxOutput: number;
  temperature: number;
  /** Whether this model reliably supports tools/function calling. */
  tools: boolean;
  /** Whether this model emits <think>/<thinking>/<|begin_of_thought|>/reasoning_content blocks. */
  emitsThinking: boolean;
}

export const MODEL_CATALOG: Record<string, ModelConfig> = {
  // --- Token Harbor / OpenAI-compatible primary ---
  'deepseek-v4.1-flash': {
    id: 'deepseek-v4.1-flash',
    label: 'deepseek-v4.1-flash-mimo',
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    temperature: 0.4,
    tools: true,
    emitsThinking: false, // V4.1 MIMO doesn't emit chain-of-thought by default
  },
  'deepseek-v4.1-flash:free': {
    id: 'deepseek-v4.1-flash:free',
    label: 'deepseek-v4.1-flash-mimo-free',
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    temperature: 0.4,
    tools: true,
    emitsThinking: false,
  },
  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash',
    label: 'deepseek-v4-flash',
    contextWindow: 512_000,
    maxOutput: 1200,
    temperature: 0.4,
    tools: true,
    emitsThinking: false,
  },
  'deepseek-v4-flash:free': {
    id: 'deepseek-v4-flash:free',
    label: 'deepseek-v4-flash-free',
    contextWindow: 512_000,
    maxOutput: 1200,
    temperature: 0.4,
    tools: true,
    emitsThinking: false,
  },
  'zai/glm-5.3-flash': {
    id: 'zai/glm-5.3-flash',
    label: 'glm-5.3-flash',
    contextWindow: 400_000,
    maxOutput: 900,
    temperature: 0.45,
    tools: true,
    emitsThinking: true, // GLM thinking blocks are always-on
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
  'mimo-v2.5': {
    id: 'mimo-v2.5',
    label: 'mimo-v2.5',
    contextWindow: 256_000,
    maxOutput: 1200,
    temperature: 0.4,
    tools: false,
    emitsThinking: true,
  },
  'mimo-v2.6-flash:free': {
    id: 'mimo-v2.6-flash:free',
    label: 'mimo-v2.6-flash-free',
    contextWindow: 256_000,
    maxOutput: 1200,
    temperature: 0.4,
    tools: false,
    emitsThinking: true,
  },
  // --- Dahl legacy (kept for backwards compat if AI_PROVIDER=dahl) ---
  'deepseek-ai/DeepSeek-V4-Flash-0731': {
    id: 'deepseek-ai/DeepSeek-V4-Flash-0731',
    label: 'deepseek-v4-flash-dahl',
    contextWindow: 400_000,
    maxOutput: 600,
    temperature: 0.45,
    tools: true,
    emitsThinking: false,
  },
  'zai-org/GLM-5.3-Flash': {
    id: 'zai-org/GLM-5.3-Flash',
    label: 'glm-5.3-flash-dahl',
    contextWindow: 400_000,
    maxOutput: 900,
    temperature: 0.45,
    tools: true,
    emitsThinking: true,
  },
};

export function pickModel(env: {
  AI_PROVIDER?: string;
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

  // Default primary depends on provider
  const isTokenHarbor = !env.AI_PROVIDER ||
    ['tokenharbor','token_harbor','th'].includes(env.AI_PROVIDER);
  // Default to the :free route — zero-balance accounts work out of the box.
  // Set AI_MODEL=deepseek-v4.1-flash (no :free) in secrets to switch to paid.
  const primary = isTokenHarbor
    ? 'deepseek-v4.1-flash:free'
    : 'deepseek-ai/DeepSeek-V4-Flash-0731';

  switch (tier) {
    case 'fast':      return primary;
    case 'standard':  return primary;
    case 'reasoning': return primary; // V4.1 MIMO handles reasoning well enough for our workloads
  }
}

/**
 * Fallback chain:
 *   primary → deepseek-v4-flash (dual) → GLM-5.3-Flash → MiniMax-M2.7
 *
 * When running on Token Harbor (default), use Token Harbor-native model IDs.
 * When running on Dahl (legacy), use Dahl-native model IDs and stop after GLM
 * (MiniMax is manual-select only on Dahl to avoid surprise reasoning costs).
 *
 * AI_MODEL_FALLBACK can override the immediate fallback (useful for testing).
 */
export function fallbackChain(env: {
  AI_PROVIDER?: string;
  AI_MODEL_FALLBACK?: string;
}, primaryId: string): string[] {
  const isTokenHarbor = !env.AI_PROVIDER ||
    ['tokenharbor','token_harbor','th'].includes(env.AI_PROVIDER);

  const defaults = isTokenHarbor
    ? ['deepseek-v4-flash:free', 'mimo-v2.6-flash:free']
    : ['zai-org/GLM-5.3-Flash'];

  // If user specified an explicit fallback list (comma separated), split and use it.
  let chain: string[];
  if (env.AI_MODEL_FALLBACK) {
    chain = env.AI_MODEL_FALLBACK.split(',').map(s => normaliseModelId(s.trim())).filter(Boolean);
  } else {
    chain = defaults;
  }

  const ordered: string[] = [primaryId];
  for (const m of chain) {
    const nm = normaliseModelId(m);
    if (nm && nm !== primaryId && !ordered.includes(nm)) ordered.push(nm);
  }
  return ordered;
}

export function getModelConfig(id: string): ModelConfig {
  return MODEL_CATALOG[id] ?? {
    id, label: id, contextWindow: 128_000, maxOutput: 600,
    temperature: 0.4, tools: false, emitsThinking: false,
  };
}

/** Aliases / historical names to normalise so we don't 400 on old stored prefs. */
export function normaliseModelId(id: string): string {
  if (!id) return id;
  const m: Record<string, string> = {
    // Token Harbor aliases — default to :free unless paid suffix explicitly used
    'DeepSeek-V4.1-Flash': 'deepseek-v4.1-flash:free',
    'deepseek-v4.1-flash': 'deepseek-v4.1-flash:free',
    'deepseek-v4.1-flash-mimo': 'deepseek-v4.1-flash:free',
    'DeepSeek-V4-Flash': 'deepseek-v4-flash:free',
    'deepseek-v4-flash-0731': 'deepseek-v4-flash:free',
    'deepseek-v4-flash': 'deepseek-v4-flash:free',
    'glm-5.3-flash': 'zai/glm-5.3-flash',
    'GLM-5.3-Flash': 'zai/glm-5.3-flash',
    'zai-org/glm-5.3-flash': 'zai/glm-5.3-flash',
    'glm-5.3': 'zai/glm-5.3-flash',
    'minimax-m2.7': 'MiniMaxAI/MiniMax-M2.7',
    'MiniMax-M2.7': 'MiniMaxAI/MiniMax-M2.7',
    // Dahl legacy (still valid if AI_PROVIDER=dahl)
    'deepseek-ai/DeepSeek-V4-Flash-0731': 'deepseek-ai/DeepSeek-V4-Flash-0731',
    'deepseek-ai/DeepSeek-V4-Flash': 'deepseek-ai/DeepSeek-V4-Flash-0731',
    'zai-org/GLM-5.3-Flash': 'zai-org/GLM-5.3-Flash',
    // Old hardcoded defaults -> Token Harbor versions
    'deepseek-ai/DeepSeek-V3-Flash': 'deepseek-v4.1-flash',
  };
  return m[id] ?? id;
}
