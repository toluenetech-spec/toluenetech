import type { AIProvider, ChatCompletionInput, ChatCompletionOutput } from '../types';

interface Options { apiKey: string; model?: string }

export function createAnthropicProvider({ apiKey, model = 'claude-3-5-haiku-latest' }: Options): AIProvider {
  return {
    name: `anthropic:${model}`,
    async chat(messages, opts) { const o = await this.complete({ messages, model: opts?.model ?? model, temperature: opts?.temperature, maxTokens: opts?.maxTokens, signal: opts?.signal }); return o.content; },
    async complete(_input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      // Minimal stub — Dahl is the active provider; Anthropic is wired for future.
      throw new Error('Anthropic adapter is a stub — use Dahl');
    },
  };
}
