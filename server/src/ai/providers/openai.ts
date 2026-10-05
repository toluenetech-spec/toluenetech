import type { AIProvider, ChatMessage } from '../types';

interface Options { apiKey: string; model?: string; }

export function createOpenAIProvider({ apiKey, model = 'gpt-4o-mini' }: Options): AIProvider {
  const endpoint = 'https://api.openai.com/v1/chat/completions';
  return {
    name: `openai:${model}`,
    async chat(messages, opts) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: opts?.model ?? model,
          messages,
          temperature: opts?.temperature ?? 0.4,
          max_tokens: opts?.maxTokens ?? 600,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${t.slice(0, 240)}`);
      }
      const json = await res.json() as { choices: { message: { content: string } }[] };
      return json.choices?.[0]?.message?.content?.trim() ?? '';
    },
    async *stream(messages, opts) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: opts?.model ?? model,
          messages,
          temperature: opts?.temperature ?? 0.4,
          max_tokens: opts?.maxTokens ?? 600,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`OpenAI stream error ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) yield delta;
          } catch { /* ignore partial */ }
        }
      }
    },
  };
}
