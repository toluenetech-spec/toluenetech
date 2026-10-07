import { AIConfigError, type ChatMessage } from './types';
import { createDahlProvider } from './providers/dahl';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { fallbackChain, getModelConfig, pickModel, type TaskTier } from './models';
import { stripThinking } from './strip-thinking';
import type { Env } from '../env';
import { getDb } from '../db';
type DB = ReturnType<typeof getDb>;

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ChatRequest {
  messages: ChatMessage[];
  tier?: TaskTier;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolSpec[];
  responseFormat?: 'text' | 'json_object';
  maxTurns?: number;
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  toolCalls: { name: string; args: unknown; ok: boolean; durationMs: number }[];
  model: string;
  usedFallback: boolean;
  reasoningTurns: number;
}

export interface ToolContext {
  kind: 'public' | 'admin' | 'client';
  auth: { uid?: string; email?: string; name?: string; clientId?: string; role?: string } | null;
  db: DB;
  env: Env;
  ip: string;
  session?: { id?: string; anonId?: string; capturedLeadId?: string | null; intent?: string | null };
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<{
  result: unknown;
  stop?: boolean;
  reply?: string;
  /** Optional: append additional system-level guidance for the model */
  followUp?: string;
}>;

/**
 * Primary AI client. Handles:
 *  - tier-based model selection
 *  - automatic fallback across the model chain on error / timeout / empty response
 *  - tool-call loop (with max-turn budget)
 *  - per-call timeout (AbortController)
 *  - thinking-tag stripping
 */
export function getAI(env: Env) {
  if (!env.AI_PROVIDER || !env.AI_API_KEY) throw new AIConfigError('AI not configured');

  function makeProvider(modelId: string) {
    switch (env.AI_PROVIDER) {
      case 'openai':    return createOpenAIProvider({ apiKey: env.AI_API_KEY!, model: modelId });
      case 'anthropic': return createAnthropicProvider({ apiKey: env.AI_API_KEY!, model: modelId });
      case 'gemini':    return createGeminiProvider({ apiKey: env.AI_API_KEY!, model: modelId });
      case 'dahl':      return createDahlProvider({ apiKey: env.AI_API_KEY!, model: modelId });
      default: throw new AIConfigError(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}`);
    }
  }

  async function run(req: ChatRequest, toolHandlers: Record<string, ToolHandler> = {}, ctx: ToolContext): Promise<ChatResult> {
    const primaryId = req.model ?? pickModel(env, req.tier ?? 'standard');
    const chain = fallbackChain(env, primaryId);
    const toolsByName: Record<string, ToolSpec> = {};
    for (const t of req.tools ?? []) toolsByName[t.name] = t;
    const maxTurns = Math.min(Math.max(1, req.maxTurns ?? 6), 10);
    const defaultTimeout = req.timeoutMs ?? (req.tier === 'fast' ? 12_000 : 25_000);

    let lastErr: unknown = null;
    for (const modelId of chain) {
      try {
        return await runOnModel(modelId, req, toolHandlers, toolsByName, ctx, maxTurns, defaultTimeout);
      } catch (e) {
        lastErr = e;
        // Try next model
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('All models failed');
  }

  async function runOnModel(
    modelId: string,
    req: ChatRequest,
    toolHandlers: Record<string, ToolHandler>,
    toolsByName: Record<string, ToolSpec>,
    ctx: ToolContext,
    maxTurns: number,
    defaultTimeout: number,
  ): Promise<ChatResult> {
    const cfg = getModelConfig(modelId);
    const provider = makeProvider(modelId);
    const canTools = cfg.tools && (req.tools?.length ?? 0) > 0;
    const messages: ChatMessage[] = req.messages.map(m => ({ ...m }));
    const audit: ChatResult['toolCalls'] = [];
    let turns = 0;
    const started = Date.now();

    while (turns < maxTurns) {
      turns++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), defaultTimeout);
      let out;
      try {
        out = await provider.complete({
          messages,
          model: modelId,
          temperature: req.temperature ?? cfg.temperature,
          maxTokens: req.maxTokens ?? cfg.maxOutput,
          responseFormat: req.responseFormat,
          tools: canTools ? (req.tools ?? []).map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) : undefined,
          toolChoice: canTools ? 'auto' : undefined,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const cleaned = stripThinking(out.content || '');
      if (!out.toolCalls.length) {
        if (!cleaned) throw new Error(`Empty response from ${modelId}`);
        return { content: cleaned, toolCalls: audit, model: modelId, usedFallback: false, reasoningTurns: turns };
      }
      // Append assistant marker
      messages.push({ role: 'assistant', content: cleaned });
      for (const tc of out.toolCalls) {
        const t0 = Date.now();
        const name = tc.function?.name ?? '';
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); }
        catch { args = { _invalidArgs: tc.function?.arguments }; }

        if (!toolsByName[name] || !toolHandlers[name]) {
          messages.push({ role: 'user', content: `[tool error] tool "${name}" is not available.` });
          audit.push({ name, args, ok: false, durationMs: Date.now() - t0 });
          continue;
        }
        // Whitelist: only allow declared tools
        try {
          args = sanitizeArgs(args, toolsByName[name].parameters);
          const r = await toolHandlers[name](args, ctx);
          const resultText = typeof r.result === 'string' ? r.result : JSON.stringify(r.result ?? null);
          messages.push({ role: 'user', content: `[tool_result:${name}]\n${resultText}${r.followUp ? '\n\nNote: ' + r.followUp : ''}` });
          audit.push({ name, args, ok: true, durationMs: Date.now() - t0 });
          if (r.stop) {
            return {
              content: stripThinking((r.reply ?? cleaned) || "Done."),
              toolCalls: audit,
              model: modelId,
              usedFallback: false,
              reasoningTurns: turns,
            };
          }
        } catch (e) {
          const msg = (e as Error).message || 'tool error';
          messages.push({ role: 'user', content: `[tool error:${name}] ${msg}` });
          audit.push({ name, args, ok: false, durationMs: Date.now() - t0 });
        }
      }
    }
    return {
      content: "I worked on that for a while and hit my step limit. Could you rephrase or ask me to continue?",
      toolCalls: audit,
      model: modelId,
      usedFallback: false,
      reasoningTurns: turns,
    };
  }

  return { run };
}

/** Best-effort sanitisation of tool arguments against a JSON schema:
 *  drops unknown keys, coerces simple types. This is defence in depth —
 *  real validation happens inside each tool handler. */
function sanitizeArgs(args: Record<string, unknown>, schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const props = (schema.properties as Record<string, { type?: string }> | undefined) ?? {};
  for (const [k, v] of Object.entries(args)) {
    if (!(k in props)) continue; // drop unknown
    const t = props[k]?.type;
    if (t === 'string') out[k] = String(v ?? '').slice(0, 4000);
    else if (t === 'number' || t === 'integer') out[k] = Number(v) || 0;
    else if (t === 'boolean') out[k] = Boolean(v);
    else if (t === 'array') out[k] = Array.isArray(v) ? v.slice(0, 50) : [];
    else out[k] = v;
  }
  return out;
}

export type { Env };
