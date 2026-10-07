import { AIConfigError, type ChatMessage } from './types';
import { createDahlProvider } from './providers/dahl';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { fallbackChain, getModelConfig, normaliseModelId, pickModel, type TaskTier } from './models';
import { stripThinking } from './strip-thinking';
import type { Env } from '../env';
import { getDb } from '../db';
type DB = ReturnType<typeof getDb>;

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tier?: TaskTier;
  model?: string;
  /** Explicit fallback chain (primary is always at index 0 implicitly). */
  fallbackModels?: string[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolSpec[];
  responseFormat?: 'text' | 'json_object';
  maxTurns?: number;
  timeoutMs?: number;
  /** Short identifier for server logs (surface/endpoint). */
  label?: string;
}

export interface ChatResult {
  content: string;
  toolCalls: ToolAudit[];
  model: string;
  usedFallback: boolean;
  reasoningTurns: number;
  error?: AIErrorInfo; // set when the call ultimately failed
}

export interface ToolAudit {
  name: string;
  args: unknown;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export type AIErrorCode =
  | 'MODEL_ERROR'
  | 'FALLBACK_ERROR'
  | 'TOOL_ERROR'
  | 'DATABASE_ERROR'
  | 'AUTH_ERROR'
  | 'TIMEOUT'
  | 'INVALID_TOOL_ARGUMENTS'
  | 'EMPTY_MODEL_RESPONSE'
  | 'CONFIG_ERROR'
  | 'UNKNOWN';

export interface AIErrorInfo {
  code: AIErrorCode;
  message: string; // user-safe message
  cause?: string;  // internal detail (logged, NOT sent to user)
  model?: string;
  httpStatus?: number;
}

export class AIError extends Error {
  info: AIErrorInfo;
  constructor(info: AIErrorInfo) {
    super(info.message);
    this.info = info;
  }
}

export interface ToolContext {
  kind: 'public' | 'admin' | 'client' | 'lab';
  auth: { uid?: string; email?: string; name?: string; clientId?: string; role?: string } | null;
  db: DB | null;
  env: Env;
  ip: string;
  session?: { id?: string; anonId?: string; capturedLeadId?: string | null; intent?: string | null };
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<{
  result: unknown;
  stop?: boolean;
  reply?: string;
  followUp?: string;
}>;

/** Best-effort server-side logger — console.log is fine on Workers;
 *  structured enough to grep in production. */
function log(label: string, ev: Record<string, unknown>) {
  try { console.log(JSON.stringify({ ts: new Date().toISOString(), ai: label, ...ev })); } catch { /* noop */ }
}

export function getAI(env: Env) {
  if (!env.AI_PROVIDER || !env.AI_API_KEY) throw new AIConfigError('AI not configured');

  function makeProvider(rawModelId: string) {
    const modelId = normaliseModelId(rawModelId);
    switch (env.AI_PROVIDER) {
      case 'openai':    return { provider: createOpenAIProvider({ apiKey: env.AI_API_KEY!, model: modelId }), modelId };
      case 'anthropic': return { provider: createAnthropicProvider({ apiKey: env.AI_API_KEY!, model: modelId }), modelId };
      case 'gemini':    return { provider: createGeminiProvider({ apiKey: env.AI_API_KEY!, model: modelId }), modelId };
      case 'dahl':      return { provider: createDahlProvider({ apiKey: env.AI_API_KEY!, model: modelId }), modelId };
      default: throw new AIConfigError(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}`);
    }
  }

  async function run(req: ChatRequest, toolHandlers: Record<string, ToolHandler> = {}, ctx: ToolContext): Promise<ChatResult> {
    const primaryRaw = req.model ?? pickModel(env as any, req.tier ?? 'standard');
    const primary = normaliseModelId(primaryRaw);
    // Allow caller to override the fallback chain (per-surface config).
    const chain = (req.fallbackModels && req.fallbackModels.length > 0)
      ? [primary, ...req.fallbackModels.map(normaliseModelId)].filter((v, i, a) => a.indexOf(v) === i)
      : fallbackChain(env as any, primary).map(normaliseModelId);
    const toolsByName: Record<string, ToolSpec> = {};
    for (const t of req.tools ?? []) toolsByName[t.name] = t;
    const maxTurns = Math.min(Math.max(1, req.maxTurns ?? 6), 10);
    const defaultTimeout = req.timeoutMs ?? (req.tier === 'fast' ? 15_000 : 30_000);
    const label = req.label ?? ctx.kind;

    const audit: ToolAudit[] = [];
    let lastErr: AIErrorInfo | null = null;
    let usedFallback = false;

    for (let mi = 0; mi < chain.length; mi++) {
      const modelId = chain[mi];
      if (mi > 0) usedFallback = true;
      try {
        const res = await runOnModel(modelId, req, toolHandlers, toolsByName, ctx, maxTurns, defaultTimeout, audit, label);
        return { ...res, usedFallback, toolCalls: audit.slice() };
      } catch (e) {
        const info = toErrorInfo(e, modelId);
        log(label, { event: 'model_failed', model: modelId, code: info.code, cause: info.cause ?? info.message, attempt: mi + 1, chain });
        lastErr = info;
        // Abort errors are timeouts — try fallback immediately.
        // If the error is permanent (401/403/404 config), still try fallback
        // because fallback may be a different provider/model.
        continue;
      }
    }
    // All models failed
    const err: AIErrorInfo = lastErr ?? {
      code: 'MODEL_ERROR',
      message: userFacingMessage(lastErr),
    };
    log(label, { event: 'all_models_failed', chain, code: err.code, cause: err.cause ?? err.message });
    throw new AIError(err);
  }

  async function runOnModel(
    modelId: string,
    req: ChatRequest,
    toolHandlers: Record<string, ToolHandler>,
    toolsByName: Record<string, ToolSpec>,
    ctx: ToolContext,
    maxTurns: number,
    defaultTimeout: number,
    audit: ToolAudit[],
    label: string,
  ): Promise<ChatResult> {
    const cfg = getModelConfig(modelId);
    const { provider, modelId: usedModel } = makeProvider(modelId);
    const tools = req.tools ?? [];
    // Only send tools when both the model supports them AND we have tools.
    const canTools = cfg.tools && tools.length > 0;
    const messages: ChatMessage[] = req.messages.map(m => ({ ...m }));
    let turns = 0;

    while (turns < maxTurns) {
      turns++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), defaultTimeout);
      let out;
      try {
        out = await provider.complete({
          messages,
          model: usedModel,
          temperature: req.temperature ?? cfg.temperature,
          maxTokens: req.maxTokens ?? cfg.maxOutput,
          responseFormat: req.responseFormat,
          tools: canTools ? tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) : undefined,
          toolChoice: canTools ? 'auto' : undefined,
          signal: ctrl.signal,
        });
      } catch (e) {
        clearTimeout(timer);
        const err = e as Error;
        if (err?.name === 'AbortError' || /abort/i.test(err?.message || '')) {
          throw new AIError({ code: 'TIMEOUT', message: 'The model took too long to respond.', cause: `timeout after ${defaultTimeout}ms on ${usedModel}`, model: usedModel });
        }
        throw e; // let run() categorize Dahl/HTTP errors
      }
      clearTimeout(timer);

      const cleaned = stripThinking(out.content || '');
      if (!out.toolCalls.length) {
        if (!cleaned) {
          throw new AIError({ code: 'EMPTY_MODEL_RESPONSE', message: 'The model returned an empty response.', model: usedModel });
        }
        return { content: cleaned, toolCalls: audit, model: usedModel, usedFallback: false, reasoningTurns: turns };
      }

      messages.push({ role: 'assistant', content: cleaned });

      for (const tc of out.toolCalls) {
        const t0 = Date.now();
        const name = tc.function?.name ?? '';
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          messages.push({ role: 'user', content: `[tool error] invalid JSON arguments for "${name}".` });
          audit.push({ name, args: tc.function?.arguments, ok: false, durationMs: Date.now() - t0, error: 'invalid_json' });
          continue;
        }

        if (!toolsByName[name] || !toolHandlers[name]) {
          messages.push({ role: 'user', content: `[tool error] tool "${name}" is not available.` });
          audit.push({ name, args, ok: false, durationMs: Date.now() - t0, error: 'unknown_tool' });
          continue;
        }

        try {
          args = sanitizeArgs(args, toolsByName[name].parameters);
        } catch (sanErr) {
          messages.push({ role: 'user', content: `[tool error:${name}] invalid arguments.` });
          audit.push({ name, args, ok: false, durationMs: Date.now() - t0, error: 'invalid_args' });
          continue;
        }

        try {
          const r = await toolHandlers[name](args, ctx);
          const resultText = typeof r.result === 'string' ? r.result : JSON.stringify(r.result ?? null);
          messages.push({ role: 'user', content: `[tool_result:${name}]\n${resultText}${r.followUp ? '\n\nNote: ' + r.followUp : ''}` });
          audit.push({ name, args, ok: true, durationMs: Date.now() - t0 });
          if (r.stop) {
            return {
              content: stripThinking((r.reply ?? cleaned) || "Done."),
              toolCalls: audit,
              model: usedModel,
              usedFallback: false,
              reasoningTurns: turns,
            };
          }
        } catch (e) {
          const msg = (e as Error).message || 'tool error';
          const isDb = /database|db|sql|neon|drizzle|connection|relation/i.test(msg);
          const code: AIErrorCode = isDb ? 'DATABASE_ERROR' : 'TOOL_ERROR';
          log(label, { event: 'tool_error', tool: name, code, cause: msg.slice(0, 300) });
          messages.push({ role: 'user', content: `[tool error:${name}] ${userFacingToolMsg(name, msg)}` });
          audit.push({ name, args, ok: false, durationMs: Date.now() - t0, error: msg.slice(0, 200) });
        }
      }
    }

    return {
      content: "I worked on that for a while and hit my step limit. Could you rephrase or ask me to continue?",
      toolCalls: audit,
      model: usedModel,
      usedFallback: false,
      reasoningTurns: turns,
    };
  }

  return { run };
}

function toErrorInfo(e: unknown, model?: string): AIErrorInfo {
  if (e instanceof AIError) return e.info;
  if (e instanceof AIConfigError) return { code: 'CONFIG_ERROR', message: 'AI is not configured yet.', cause: e.message, model };
  const err = e as Error;
  const msg = err?.message || String(e);
  // Dahl errors look like "Dahl error 400: {...}" or "Dahl error 401: ..."
  const m = msg.match(/^Dahl error (\d{3}):\s*([\s\S]*)$/);
  if (m) {
    const status = Number(m[1]);
    const body = m[2].slice(0, 500);
    if (status === 401 || status === 403) return { code: 'CONFIG_ERROR', message: 'AI key is invalid.', cause: `auth ${status}: ${body}`, model, httpStatus: status };
    if (status === 404 || /model.*(not found|retired|invalid|does not exist)/i.test(body)) return { code: 'MODEL_ERROR', message: 'That model is temporarily unavailable.', cause: `model ${status}: ${body}`, model, httpStatus: status };
    if (status === 429) return { code: 'MODEL_ERROR', message: 'The AI is busy right now.', cause: `rate ${status}: ${body}`, model, httpStatus: status };
    if (status >= 500) return { code: 'MODEL_ERROR', message: 'The AI provider returned an error.', cause: `server ${status}: ${body}`, model, httpStatus: status };
    return { code: 'MODEL_ERROR', message: 'The AI request failed.', cause: `http ${status}: ${body}`, model, httpStatus: status };
  }
  if (/abort|timeout|timed out/i.test(msg)) return { code: 'TIMEOUT', message: 'The model took too long.', cause: msg, model };
  if (/empty/i.test(msg)) return { code: 'EMPTY_MODEL_RESPONSE', message: 'The model returned no content.', cause: msg, model };
  return { code: 'MODEL_ERROR', message: 'The AI request failed.', cause: msg, model };
}

function userFacingMessage(info: AIErrorInfo | null): string {
  if (!info) return 'Something went wrong reaching our AI.';
  // Always return a friendly, generic message. Routes may override with surface-specific wording.
  return "I'm having trouble reaching our models right now. Please try again in a moment.";
}

function userFacingToolMsg(_name: string, raw: string): string {
  // Don't leak SQL/DB internals to the model.
  if (/syntax|syntax error|relation|column|constraint|duplicate/i.test(raw)) return 'a database lookup failed.';
  if (/timeout|timed out/i.test(raw)) return 'the lookup timed out.';
  return 'the lookup encountered an error.';
}

function sanitizeArgs(args: Record<string, unknown>, schema: Record<string, unknown>): Record<string, unknown> {
  if (!args || typeof args !== 'object') throw new Error('args must be object');
  const out: Record<string, unknown> = {};
  const props = (schema.properties as Record<string, { type?: string }> | undefined) ?? {};
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  for (const k of required) {
    if (!(k in args)) {
      // Don't throw — let handler validate. Pass through absent keys as undefined;
      // the handler will return a tool_error message for the model.
    }
  }
  for (const [k, v] of Object.entries(args)) {
    if (!(k in props)) continue;
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
