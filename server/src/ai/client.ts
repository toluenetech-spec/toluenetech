import { AIConfigError, type ChatMessage } from './types';
import { createDahlProvider } from './providers/dahl';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { createTokenHarborProvider } from './providers/tokenharbor';
import { fallbackChain, getModelConfig, normaliseModelId, pickModel, type TaskTier } from './models';
import { stripThinking } from './strip-thinking';
import { extractXmlToolCalls } from './parse-tool-calls';
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

/** Resolve which provider + API key to use for a given model ID.
 *  Routing rules (first match wins):
 *   - model contains ':' (e.g. deepseek-v4-flash:free, mimo-v2.6-flash:free) → Token Harbor
 *   - model contains '/' (maker prefix, e.g. deepseek-ai/..., MiniMaxAI/..., zai-org/...) → Dahl
 *   - model known to the catalog (MODEL_CATALOG) with provider hint
 *   - fallback: AI_PROVIDER env (default 'tokenharbor')
 */
function resolveProvider(env: Env, modelId: string): { providerName: 'tokenharbor' | 'dahl' | 'openai' | 'anthropic' | 'gemini'; apiKey: string } {
  // Prefer provider-specific keys, fall back to legacy AI_API_KEY.
  const keys = {
    tokenharbor: env.AI_TOKENHARBOR_KEY || env.AI_API_KEY,
    dahl:        env.AI_DAHL_KEY        || env.AI_API_KEY,
    openai:      env.AI_OPENAI_KEY      || env.AI_API_KEY,
    anthropic:   env.AI_ANTHROPIC_KEY   || env.AI_API_KEY,
    gemini:      env.AI_GEMINI_KEY      || env.AI_API_KEY,
  };
  const defaultProvider: 'tokenharbor' | 'dahl' | 'openai' | 'anthropic' | 'gemini' =
    !env.AI_PROVIDER || ['tokenharbor','token_harbor','th'].includes(env.AI_PROVIDER) ? 'tokenharbor'
    : env.AI_PROVIDER === 'dahl' ? 'dahl'
    : (env.AI_PROVIDER as any);

  let chosen: keyof typeof keys = defaultProvider;
  if (modelId.includes(':')) chosen = 'tokenharbor';
  else if (modelId.includes('/')) chosen = 'dahl';
  else if (/^gpt-|^o\d|^chatgpt/i.test(modelId)) chosen = 'openai';
  else if (/^claude/i.test(modelId)) chosen = 'anthropic';
  else if (/^gemini|^gemma/i.test(modelId)) chosen = 'gemini';

  const apiKey = keys[chosen];
  if (!apiKey) throw new AIConfigError(`AI not configured: missing API key for ${chosen} (set AI_${chosen.toUpperCase()}_KEY secret).`);
  return { providerName: chosen as any, apiKey };
}

export function getAI(env: Env) {
  const hasAnyKey = !!(env.AI_TOKENHARBOR_KEY || env.AI_DAHL_KEY || env.AI_API_KEY || env.AI_OPENAI_KEY || env.AI_ANTHROPIC_KEY || env.AI_GEMINI_KEY);
  if (!hasAnyKey) throw new AIConfigError('AI not configured — set at least one of AI_TOKENHARBOR_KEY / AI_DAHL_KEY / AI_API_KEY.');

  function makeProvider(rawModelId: string) {
    const modelId = normaliseModelId(rawModelId);
    const { providerName, apiKey } = resolveProvider(env, modelId);
    switch (providerName) {
      case 'openai':    return { provider: createOpenAIProvider({ apiKey, model: modelId }), modelId, providerName };
      case 'anthropic': return { provider: createAnthropicProvider({ apiKey, model: modelId }), modelId, providerName };
      case 'gemini':    return { provider: createGeminiProvider({ apiKey, model: modelId }), modelId, providerName };
      case 'dahl':      return { provider: createDahlProvider({ apiKey, model: modelId }), modelId, providerName };
      case 'tokenharbor':
      default:          return { provider: createTokenHarborProvider({ apiKey, model: modelId }), modelId, providerName: 'tokenharbor' as const };
    }
  }

  /** Rewrite maker-prefixed Dahl IDs → TH free IDs only when TH key is configured
   *  and Dahl key is NOT (otherwise Dahl-prefixed IDs are fine on Dahl). If the
   *  caller explicitly selected a Dahl model via surface config AND a Dahl key
   *  is present, leave it alone — user chose Dahl. */
  function providerSafe(id: string): string {
    const n = normaliseModelId(id);
    const hasThKey = !!(env.AI_TOKENHARBOR_KEY || env.AI_API_KEY);
    const hasDahlKey = !!env.AI_DAHL_KEY;
    if (n.includes('/') && !hasDahlKey && hasThKey) {
      // Stale config pointing at Dahl but we have no Dahl key → redirect to TH free models.
      if (/glm/i.test(n)) return 'deepseek-v4-flash:free';
      if (/minimax/i.test(n)) return 'mimo-v2.6-flash:free';
      if (/deepseek/i.test(n)) return 'deepseek-v4-flash:free';
      return 'deepseek-v4.1-flash:free';
    }
    if (n.includes(':') && !hasThKey && hasDahlKey) {
      // TH-style :free suffix but no TH key → map to a Dahl model.
      return 'deepseek-ai/DeepSeek-V4-Flash-0731';
    }
    return n;
  }

  async function run(req: ChatRequest, toolHandlers: Record<string, ToolHandler> = {}, ctx: ToolContext): Promise<ChatResult> {
    const primaryRaw = req.model ?? pickModel(env as any, req.tier ?? 'standard');
    const primary = providerSafe(primaryRaw);
    // Allow caller to override the fallback chain (per-surface config).
    const chain = (req.fallbackModels && req.fallbackModels.length > 0)
      ? [primary, ...req.fallbackModels.map(providerSafe)].filter((v, i, a) => a.indexOf(v) === i)
      : fallbackChain(env as any, primary).map(providerSafe);
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

      // Models on the free tier sometimes emit <toolcall> XML instead of
      // populating tool_calls JSON. Parse those blocks out before we continue.
      const xmlParsed = extractXmlToolCalls(out.content || '');
      if (xmlParsed.toolCalls.length) {
        out.toolCalls = [...(out.toolCalls || []), ...xmlParsed.toolCalls];
      }
      const cleaned = stripThinking(xmlParsed.visibleContent || '');
      if (!out.toolCalls.length) {
        if (!cleaned) {
          throw new AIError({ code: 'EMPTY_MODEL_RESPONSE', message: 'The model returned an empty response.', model: usedModel });
        }
        return { content: cleaned, toolCalls: audit, model: usedModel, usedFallback: false, reasoningTurns: turns };
      }

      messages.push({ role: 'assistant', content: cleaned });

      // Some free-tier models emit function names in camelCase
      // (adminListLeads) while our tool map uses snake_case
      // (admin_list_leads). Normalize before lookup.
      const CAMEL_TO_SNAKE = (n: string) => n.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
      const FUZZY = (n: string): string => {
        // Try exact → snake_case → strip slashes → collapse all separators (camelCase,
        // all-lowercase-mashed, slash-separated) into a canonical snake_case key.
        const candidates = [n];
        candidates.push(CAMEL_TO_SNAKE(n));
        candidates.push(n.replace(/[\/.-]/g,'_'));
        candidates.push(CAMEL_TO_SNAKE(n.replace(/[\/.-]/g,'_')));
        // mashed lowercase e.g. adminlistleads -> admin_list_leads via prefix match
        const low = n.toLowerCase().replace(/[^a-z0-9]/g,'');
        if (toolsByName[low] || toolHandlers[low]) return low;
        for (const c of candidates) {
          const k = c.toLowerCase().replace(/^_+/,'').replace(/__+/g,'_');
          if (toolsByName[k] || toolHandlers[k]) return k;
        }
        // Last resort: find a registered tool whose name, stripped of underscores,
        // matches the incoming name stripped of non-alphanumerics.
        const bare = low;
        for (const key of Object.keys(toolsByName)) {
          if (key.replace(/_/g,'') === bare) return key;
        }
        for (const key of Object.keys(toolHandlers)) {
          if (key.replace(/_/g,'') === bare) return key;
        }
        return n;
      };
      for (const tc of out.toolCalls) {
        const t0 = Date.now();
        let name = FUZZY(tc.function?.name ?? '');
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
