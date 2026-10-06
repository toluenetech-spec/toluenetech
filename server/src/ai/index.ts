import { AIConfigError, type AIProvider, type ChatMessage } from './types';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { createDahlProvider } from './providers/dahl';
import type { Env } from '../env';

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export function getAIProvider(env: Env, opts?: { model?: string }): AIProvider {
  if (!env.AI_PROVIDER || !env.AI_API_KEY) {
    throw new AIConfigError('AI_PROVIDER and AI_API_KEY are not configured.');
  }
  // Default model by provider; callers can override per-route (e.g. DeepSeek for public).
  let defaultModel = env.AI_MODEL;
  if (!defaultModel) {
    defaultModel = env.AI_PROVIDER === 'dahl' ? 'MiniMaxAI/MiniMax-M2.7' : '';
  }
  const model = opts?.model ?? defaultModel;
  switch (env.AI_PROVIDER) {
    case 'openai':    return createOpenAIProvider({ apiKey: env.AI_API_KEY, model });
    case 'anthropic': return createAnthropicProvider({ apiKey: env.AI_API_KEY, model });
    case 'gemini':    return createGeminiProvider({ apiKey: env.AI_API_KEY, model });
    case 'dahl':      return createDahlProvider({ apiKey: env.AI_API_KEY, model });
    default: throw new AIConfigError(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}`);
  }
}

export { AIConfigError } from './types';
export type { AIProvider, ChatMessage } from './types';

