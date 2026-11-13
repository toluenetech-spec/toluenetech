/**
 * Parse XML-formatted tool calls emitted by free-tier Token Harbor models
 * (deepseek-v4.1-flash:free sometimes ignores OpenAI tools param and emits
 * toolcall XML instead of native tool_calls JSON). Normalizes to standard
 * ToolCall[] and strips XML from visible content so the UI never shows raw
 * markup.
 */
import type { ToolCall } from './types';

export interface Parsed { toolCalls: ToolCall[]; visibleContent: string; }

const OPEN = "<toolcall";
const CLOSE = "/<toolcall>";
const FNO = "<function";
const FNC = "/<function>";
const PO = "<parameter";
const PC = "/<parameter>";

export function extractXmlToolCalls(raw: string): Parsed {
  const toolCalls: ToolCall[] = [];
  if (!raw) return { toolCalls, visibleContent: raw ?? '' };
  let visible = raw;
  let i = 0;
  while (i < visible.length) {
    const lo = visible.toLowerCase();
    const openIdx = lo.indexOf(OPEN.toLowerCase(), i);
    if (openIdx < 0) break;
    const tagEnd = visible.indexOf('>', openIdx);
    if (tagEnd < 0) break;
    const closeIdx = lo.indexOf(CLOSE.toLowerCase(), tagEnd);
    if (closeIdx < 0) break;
    const endIdx = closeIdx + CLOSE.length;
    const body = visible.slice(tagEnd + 1, closeIdx);
    const fn = parseFn(body);
    if (fn) {
      toolCalls.push({ id: 'xml_' + Date.now() + '_' + toolCalls.length, type: 'function', function: fn });
    }
    visible = visible.slice(0, openIdx) + visible.slice(endIdx);
    i = openIdx;
  }
  return { toolCalls, visibleContent: visible.trim() };
}

function parseFn(body: string): { name: string; arguments: string } | null {
  const o = body.toLowerCase().indexOf(FNO.toLowerCase());
  if (o < 0) return null;
  const te = body.indexOf('>', o);
  if (te < 0) return null;
  const tag = body.slice(o, te + 1);
  let name = '';
  const eq = tag.match(/<function\s*=\s*([^\s>]+)/i);
  const nm = tag.match(/<function[^>]*\sname\s*=\s*"([^"]*)"/i);
  if (eq) name = eq[1];
  else if (nm) name = nm[1];
  name = name.trim();
  if (!name) return null;
  const ce = body.toLowerCase().indexOf(FNC.toLowerCase(), te);
  const inner = body.slice(te + 1, ce >= 0 ? ce : body.length);
  const args: Record<string, unknown> = {};
  let p = 0;
  while (p < inner.length) {
    const po = inner.toLowerCase().indexOf(PO.toLowerCase(), p);
    if (po < 0) break;
    const pte = inner.indexOf('>', po);
    if (pte < 0) break;
    const ptag = inner.slice(po, pte + 1);
    const pc = inner.toLowerCase().indexOf(PC.toLowerCase(), pte);
    if (pc < 0) break;
    const val = inner.slice(pte + 1, pc);
    const keyMatch = ptag.match(/<parameter\s*=\s*([^\s>]+)/i) || ptag.match(/<parameter[^>]*\sname\s*=\s*"([^"]*)"/i);
    const key = (keyMatch ? keyMatch[1] : 'value').trim();
    if (key) args[key] = coerce(val);
    p = pc + PC.length;
  }
  return { name, arguments: Object.keys(args).length ? JSON.stringify(args) : '{}' };
}

function coerce(v: string): unknown {
  const t = v.trim();
  if (!t) return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(t)) { const n = Number(t); if (Number.isFinite(n)) return n; }
  try { return JSON.parse(t); } catch { /* ignore */ }
  return t;
}
