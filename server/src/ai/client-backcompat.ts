// Backward-compat shim — routes that import getAIProvider(env, {model}) still work.
import { AIConfigError } from './types';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { createDahlProvider } from './providers/dahl';
import { getModelConfig } from './models';
import type { Env } from '../env';
import type { AIProvider } from './types';

export function getAIProvider(env: Env, opts?: { model?: string }): AIProvider {
  if (!env.AI_PROVIDER || !env.AI_API_KEY) throw new AIConfigError('AI not configured');
  const model = opts?.model ?? (env.AI_MODEL || 'MiniMaxAI/MiniMax-M2.7');
  const cfg = getModelConfig(model);
  switch (env.AI_PROVIDER) {
    case 'openai':    return createOpenAIProvider({ apiKey: env.AI_API_KEY, model });
    case 'anthropic': return createAnthropicProvider({ apiKey: env.AI_API_KEY, model });
    case 'gemini':    return createGeminiProvider({ apiKey: env.AI_API_KEY, model });
    case 'dahl':      return createDahlProvider({ apiKey: env.AI_API_KEY, model, ...(cfg as any) });
    default: throw new AIConfigError(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}`);
  }
}
