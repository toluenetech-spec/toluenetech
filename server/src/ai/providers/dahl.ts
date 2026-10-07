import type { AIProvider, ChatMessage, ChatCompletionInput, ChatCompletionOutput, ToolCall } from '../types';

interface Options { apiKey: string; model?: string; baseUrl?: string; }

/**
 * Dahl Inference (https://inference.dahl.global/) — OpenAI-compatible.
 * Confirmed models: MiniMaxAI/MiniMax-M2.7 (primary), DeepSeek-V4-Flash (fast),
 * moonshotai/Kimi-K2.6 (fallback).
 */
export function createDahlProvider({
  apiKey,
  model = 'MiniMaxAI/MiniMax-M2.7',
  baseUrl = 'https://inference.dahl.global/v1',
}: Options): AIProvider {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  async function doFetch(input: ChatCompletionInput & { stream?: boolean }) {
    const body: Record<string, unknown> = {
      model: input.model ?? model,
      messages: input.messages,
      temperature: input.temperature ?? 0.35,
      max_tokens: input.maxTokens ?? 600,
    };
    if (input.responseFormat === 'json_object') body.response_format = { type: 'json_object' };
    if (input.tools?.length) body.tools = input.tools;
    if (input.toolChoice) body.tool_choice = input.toolChoice;
    if (input.stream) body.stream = true;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: input.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Dahl error ${res.status}: ${t.slice(0, 240)}`);
    }
    return res;
  }

  return {
    name: `dahl:${model}`,
    async chat(messages, opts) {
      const out = await this.complete({
        messages,
        model: opts?.model,
        temperature: opts?.temperature,
        maxTokens: opts?.maxTokens,
        responseFormat: opts?.responseFormat,
        tools: opts?.tools,
        toolChoice: opts?.toolChoice,
        signal: opts?.signal,
      });
      return out.content;
    },
    async complete(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
      const res = await doFetch({ ...input, stream: false });
      const json = await res.json() as {
        choices: { message: { content: string | null; tool_calls?: { id?: string; type?: 'function'; function: { name: string; arguments: string } }[] } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new Error('Empty response from Dahl');
      const toolCalls: ToolCall[] = Array.isArray(msg.tool_calls)
        ? msg.tool_calls.map(tc => ({
            id: tc.id,
            type: tc.type ?? 'function',
            function: { name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' },
          }))
        : [];
      return {
        content: msg.content ?? '',
        toolCalls,
        usage: { promptTokens: json.usage?.prompt_tokens, completionTokens: json.usage?.completion_tokens },
        model: json.model,
      };
    },
    async *stream(messages, opts) {
      const res = await doFetch({ messages, model: opts?.model, temperature: opts?.temperature, maxTokens: opts?.maxTokens, signal: opts?.signal, stream: true });
      if (!res.body) throw new Error('Dahl stream: no body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
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
            } catch { /* ignore */ }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
