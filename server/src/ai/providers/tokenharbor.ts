import type { AIProvider, ChatCompletionInput, ChatCompletionOutput, ToolCall } from '../types';

interface Options { apiKey: string; model?: string; baseUrl?: string }

/**
 * Token Harbor (https://tokenharbor.ai/) — OpenAI-compatible router that hosts
 * DeepSeek, MiMo, GLM, MiniMax, Claude, Grok, Gemini and more.
 *
 * Base URL: https://tokenharbor.ai/v1
 *
 * Primary model (Toluene Tech policy, Nov 2026):
 *   - deepseek-v4.1-flash   (DeepSeek V4.1 Flash MIMO — fast with native tool calling)
 *
 * Fallbacks available on the same provider:
 *   - deepseek-v4-flash     (DeepSeek V4 Flash 0731 — stable dual)
 *   - zai/glm-5.3-flash     (GLM-5.3-Flash)
 *   - minimax/MiniMax-M2.7  (MiniMax M2.7)
 *   - mimo-v2.5, mimo-v2.6-flash (Xiaomi MiMo)
 *
 * Free-tier model IDs carry a :free suffix (e.g. deepseek-v4.1-flash:free) but are
 * rate-limited and opt-in to data retention — use paid routes for production chats.
 */
export function createTokenHarborProvider({
  apiKey,
  model = 'deepseek-v4.1-flash',
  baseUrl = 'https://tokenharbor.ai/v1',
}: Options): AIProvider {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  async function doFetch(input: ChatCompletionInput & { stream?: boolean }) {
    const body: Record<string, unknown> = {
      model: input.model ?? model,
      messages: input.messages,
      temperature: input.temperature ?? 0.4,
      max_tokens: input.maxTokens ?? 800,
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
      throw new Error(`TokenHarbor error ${res.status}: ${t.slice(0, 260)}`);
    }
    return res;
  }

  return {
    name: `tokenharbor:${model}`,
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
        choices: { message: { content: string | null; tool_calls?: { id?: string; type?: 'function'; function: { name: string; arguments: string } }[]; reasoning_content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new Error('Empty response from Token Harbor');
      // If model emits <think>/reasoning_content, surface it stripped in the content
      // (deepseek-v4.1-flash does NOT emit thinking; GLM/MiniMax may)
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
  };
}
