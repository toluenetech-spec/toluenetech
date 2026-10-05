import { AIConfigError, type AIProvider } from './types';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import type { Env } from '../env';

export function getAIProvider(env: Env): AIProvider {
  if (!env.AI_PROVIDER || !env.AI_API_KEY) {
    throw new AIConfigError('AI_PROVIDER and AI_API_KEY are not configured.');
  }
  const model = env.AI_MODEL;
  switch (env.AI_PROVIDER) {
    case 'openai':    return createOpenAIProvider({ apiKey: env.AI_API_KEY, model });
    case 'anthropic': return createAnthropicProvider({ apiKey: env.AI_API_KEY, model });
    case 'gemini':    return createGeminiProvider({ apiKey: env.AI_API_KEY, model });
    default: throw new AIConfigError(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}`);
  }
}

export { AIConfigError } from './types';
export type { AIProvider, ChatMessage } from './types';
