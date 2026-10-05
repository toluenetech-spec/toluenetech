import type { AIProvider, ChatMessage } from '../types';

interface Options { apiKey: string; model?: string; }

export function createAnthropicProvider({ apiKey, model = 'claude-3-5-haiku-latest' }: Options): AIProvider {
  const endpoint = 'https://api.anthropic.com/v1/messages';
  return {
    name: `anthropic:${model}`,
    async chat(messages, opts) {
      // Anthropic requires system as a separate field.
      const sysIdx = messages.findIndex(m => m.role === 'system');
      const system = sysIdx >= 0 ? messages[sysIdx].content : undefined;
      const rest = messages.filter((_, i) => i !== sysIdx).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: opts?.model ?? model,
          system,
          messages: rest,
          max_tokens: opts?.maxTokens ?? 600,
          temperature: opts?.temperature ?? 0.4,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Anthropic error ${res.status}: ${t.slice(0, 240)}`);
      }
      const json = await res.json() as { content: { type: string; text: string }[] };
      return json.content?.map(c => c.text).join('')?.trim() ?? '';
    },
  };
}
