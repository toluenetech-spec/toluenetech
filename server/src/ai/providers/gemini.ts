import type { AIProvider, ChatCompletionInput, ChatCompletionOutput } from '../types';

interface Options { apiKey: string; model?: string }

export function createGeminiProvider({ apiKey, model = 'gemini-2.0-flash' }: Options): AIProvider {
  return {
    name: `gemini:${model}`,
    async chat(messages, opts) { const o = await this.complete({ messages, model: opts?.model ?? model, temperature: opts?.temperature, maxTokens: opts?.maxTokens, signal: opts?.signal }); return o.content; },
    async complete(_input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      throw new Error('Gemini adapter is a stub — use Dahl');
    },
  };
}
