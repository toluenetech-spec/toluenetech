export { getAI } from './client';
export { pickModel, fallbackChain, getModelConfig } from './models';
export type { TaskTier, ModelConfig } from './models';
export { stripThinking } from './strip-thinking';
export { createOpenAIProvider } from './providers/openai';
export { createAnthropicProvider } from './providers/anthropic';
export { createGeminiProvider } from './providers/gemini';
export { createDahlProvider } from './providers/dahl';
export { AIConfigError } from './types';
export { AIError } from './client';
export type { AIErrorCode, AIErrorInfo, ToolSpec, ChatRequest, ChatResult, ToolAudit, ToolContext, ToolHandler } from './client';
export type { AIProvider, ChatMessage, ChatCompletionInput, ChatCompletionOutput, ToolCall } from './types';
// getAIProvider kept for backward compatibility with any existing imports
import { getAIProvider as _g } from './client-backcompat';
export const getAIProvider = _g;
