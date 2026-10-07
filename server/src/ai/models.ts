/**
 * Model routing for Dahl Inference.
 *
 * Confirmed available models (Oct 2026):
 *   - MiniMaxAI/MiniMax-M2.7   : primary reasoning/agent/tool-calling model
 *   - DeepSeek-V4-Flash        : fast public-visitor chat (DeepSeek)
 *   - moonshotai/Kimi-K2.6     : long-context / reasoning fallback
 *
 * GLM-5.x is "soon" per Dahl docs; we keep a commented entry so we can add it
 * quickly once live.
 *
 * Routing tiers:
 *   tier 'fast'      → fast, cheap, short answers (public greetings, FAQ, simple Q)
 *   tier 'standard'  → balanced (default)
 *   tier 'reasoning' → strongest model (admin copilot, client assistant, lead
 *                      qualification, tool use, quotation drafting)
 */

export type TaskTier = 'fast' | 'standard' | 'reasoning';

export interface ModelConfig {
  /** Model ID passed to Dahl /chat/completions */
  id: string;
  /** Friendly label used in logging */
  label: string;
  /** Context window (tokens) — conservative; adjust as Dahl rotates capacity */
  contextWindow: number;
  /** Default max output tokens */
  maxOutput: number;
  /** Temperature */
  temperature: number;
  /** Whether the model supports tool/function calling reliably */
  tools: boolean;
  /** Whether this model is known to emit <think> blocks */
  emitsThinking: boolean;
}

/** Ordered list used by auto-fallback when a model errors out. */
export const MODEL_CATALOG: Record<string, ModelConfig> = {
  'MiniMaxAI/MiniMax-M2.7': {
    id: 'MiniMaxAI/MiniMax-M2.7',
    label: 'minimax-m2.7',
    contextWindow: 200_000,
    maxOutput: 900,
    temperature: 0.35,
    tools: true,
    emitsThinking: false,
  },
  'moonshotai/Kimi-K2.6': {
    id: 'moonshotai/Kimi-K2.6',
    label: 'kimi-k2.6',
    contextWindow: 256_000,
    maxOutput: 900,
    temperature: 0.35,
    tools: true,
    emitsThinking: false,
  },
  'DeepSeek-V4-Flash': {
    id: 'DeepSeek-V4-Flash',
    label: 'deepseek-v4-flash',
    contextWindow: 128_000,
    maxOutput: 500,
    temperature: 0.5,
    tools: false, // flash is for fast plain chat
    emitsThinking: true,
  },
  // Reserved for when GLM 5.x goes live:
  // 'zai-org/GLM-5.3-Flash': { id: 'zai-org/GLM-5.3-Flash', label: 'glm-5.3-flash', ... },
};

/** Which model handles each tier, with environment overrides. */
export function pickModel(env: { AI_MODEL?: string; AI_MODEL_PUBLIC?: string; AI_MODEL_FALLBACK?: string }, tier: TaskTier): string {
  const explicit = tier === 'fast' ? env.AI_MODEL_PUBLIC : env.AI_MODEL;
  if (explicit && MODEL_CATALOG[explicit]) return explicit;
  if (explicit) return explicit; // allow custom model IDs even if not catalogued; fallback list will catch errors
  switch (tier) {
    case 'fast':      return 'DeepSeek-V4-Flash';
    case 'standard':  return 'MiniMaxAI/MiniMax-M2.7';
    case 'reasoning': return 'MiniMaxAI/MiniMax-M2.7';
  }
}

/** Ordered fallback list to try when a model fails. Always starts with the
 *  chosen model, then alternates within its tier, then reasoning. */
export function fallbackChain(env: { AI_MODEL?: string; AI_MODEL_FALLBACK?: string }, primaryId: string): string[] {
  const fb = env.AI_MODEL_FALLBACK;
  const ordered = [primaryId];
  const push = (id: string) => { if (id && !ordered.includes(id)) ordered.push(id); };
  // Prefer explicit fallback first
  if (fb) push(fb);
  // Tier-aware fallback
  if (primaryId === 'DeepSeek-V4-Flash') {
    push('MiniMaxAI/MiniMax-M2.7');
    push('moonshotai/Kimi-K2.6');
  } else if (primaryId === 'MiniMaxAI/MiniMax-M2.7') {
    push('moonshotai/Kimi-K2.6');
    push('DeepSeek-V4-Flash');
  } else {
    push('MiniMaxAI/MiniMax-M2.7');
    push('DeepSeek-V4-Flash');
  }
  return ordered;
}

export function getModelConfig(id: string): ModelConfig {
  return MODEL_CATALOG[id] ?? {
    id, label: id, contextWindow: 64_000, maxOutput: 600, temperature: 0.4, tools: false, emitsThinking: false,
  };
}
