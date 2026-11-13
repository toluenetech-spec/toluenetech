// Backward-compat shim — routes that import getAIProvider(env, {model}) still work.
import { AIConfigError } from './types';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { createDahlProvider } from './providers/dahl';
import { createTokenHarborProvider } from './providers/tokenharbor';
import { getModelConfig } from './models';
import type { Env } from '../env';
import type { AIProvider } from './types';

export function getAIProvider(env: Env, opts?: { model?: string }): AIProvider {
  if (!env.AI_PROVIDER || !env.AI_API_KEY) throw new AIConfigError('AI not configured');
  const isTH = ['tokenharbor','token_harbor','th'].includes(env.AI_PROVIDER);
  const model = opts?.model ?? (env.AI_MODEL || (isTH ? 'deepseek-v4.1-flash:free' : 'deepseek-ai/DeepSeek-V4-Flash-0731'));
  const cfg = getModelConfig(model);
  switch (env.AI_PROVIDER) {
    case 'openai':    return createOpenAIProvider({ apiKey: env.AI_API_KEY, model });
    case 'anthropic': return createAnthropicProvider({ apiKey: env.AI_API_KEY, model });
    case 'gemini':    return createGeminiProvider({ apiKey: env.AI_API_KEY, model });
    case 'dahl':      return createDahlProvider({ apiKey: env.AI_API_KEY, model, ...(cfg as any) });
    case 'tokenharbor':
    case 'token_harbor':
    case 'th':        return createTokenHarborProvider({ apiKey: env.AI_API_KEY, model });
    default: throw new AIConfigError(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}`);
  }
}
