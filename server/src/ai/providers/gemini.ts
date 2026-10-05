import type { AIProvider, ChatMessage } from '../types';

interface Options { apiKey: string; model?: string; }

/**
 * Gemini provider using the `generateContent` REST endpoint.
 * Reads GEMINI_API_KEY style keys (AIza...).
 */
export function createGeminiProvider({ apiKey, model = 'gemini-1.5-flash' }: Options): AIProvider {
  return {
    name: `gemini:${model}`,
    async chat(messages, opts) {
      // Convert roles: system -> prepended user instruction for simplicity.
      const sysMsgs = messages.filter(m => m.role === 'system');
      const sys = sysMsgs.map(m => m.content).join('\n');
      const others = messages.filter(m => m.role !== 'system');
      const contents = [
        ...(sys ? [{ role: 'user', parts: [{ text: `Instructions:\n${sys}` }] }] : []),
        ...others.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      ];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts?.model ?? model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: opts?.temperature ?? 0.4, maxOutputTokens: opts?.maxTokens ?? 600 },
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Gemini error ${res.status}: ${t.slice(0, 240)}`);
      }
      const json = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return json.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('')?.trim() ?? '';
    },
  };
}
