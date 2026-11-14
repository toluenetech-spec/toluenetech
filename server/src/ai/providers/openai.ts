import type { AIProvider, ChatCompletionInput, ChatCompletionOutput } from '../types';

interface Options { apiKey: string; model?: string; baseUrl?: string }

export function createOpenAIProvider({ apiKey, model = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1' }: Options): AIProvider {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  return {
    name: `openai:${model}`,
    async chat(messages, opts) {
      const out = await this.complete({ messages, model: opts?.model ?? model, temperature: opts?.temperature, maxTokens: opts?.maxTokens, responseFormat: opts?.responseFormat, signal: opts?.signal });
      return out.content;
    },
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: input.model ?? model,
          messages: input.messages,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxTokens ?? 600,
          response_format: input.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
        }),
        signal: input.signal,
      });
      if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
      const json = await res.json() as any;
      return { content: json.choices?.[0]?.message?.content ?? '', toolCalls: [] };
    },
  };
}
