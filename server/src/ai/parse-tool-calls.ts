/**
 * Parse XML-formatted tool calls emitted by free-tier Token Harbor models.
 * Forgiving about common malformations:
 *   - close tags may or may not have underscores
 *   - function names in camelCase / mashed-lowercase passed through
 *   - self-closing tags handled
 *   - unclosed blocks at end of response still parsed if possible
 */
import type { ToolCall } from './types';

export interface Parsed { toolCalls: ToolCall[]; visibleContent: string; }

function findClose(hay: string, fromIdx: number, variants: string[]): { idx: number; end: number } | null {
  const lo = hay.toLowerCase();
  let best: { idx: number; end: number } | null = null;
  for (const v of variants) {
    const i = lo.indexOf(v.toLowerCase(), fromIdx);
    if (i >= 0 && (!best || i < best.idx)) best = { idx: i, end: i + v.length };
  }
  return best;
}

const OPEN = "<toolcall";
const CLOSE_VARS = ["/<toolcall>","/<tool_call>"];
const FN_CLOSE_VARS = ["/<function>"];
const PARAM_CLOSE_VARS = ["/<parameter>","/<param>"];

export function extractXmlToolCalls(raw: string): Parsed {
  const toolCalls: ToolCall[] = [];
  if (!raw) return { toolCalls, visibleContent: raw ?? '' };
  let visible = raw;
  let i = 0;
  let safety = 0;
  while (i < visible.length && safety < 50) {
    safety++;
    const lo = visible.toLowerCase();
    const openIdx = lo.indexOf(OPEN.toLowerCase(), i);
    if (openIdx < 0) break;
    const tagEnd = visible.indexOf(GT, openIdx);
    if (tagEnd < 0) break;
    if (visible[tagEnd - 1] === SL) {
      visible = visible.slice(0, openIdx) + visible.slice(tagEnd + 1);
      i = openIdx;
      continue;
    }
    const close = findClose(visible, tagEnd + 1, CLOSE_VARS);
    const endIdx = close ? close.end : visible.length;
    const body = close ? visible.slice(tagEnd + 1, close.idx) : visible.slice(tagEnd + 1);
    const fn = parseFn(body);
    if (fn) toolCalls.push({ id: 'xml_' + Date.now() + '_' + toolCalls.length, type: 'function', function: fn });
    visible = visible.slice(0, openIdx) + visible.slice(endIdx);
    i = openIdx;
  }
  return { toolCalls, visibleContent: visible.trim() };
}

function parseFn(body: string): { name: string; arguments: string } | null {
  const o = body.toLowerCase().indexOf('<function');
  if (o < 0) return null;
  const te = body.indexOf(GT, o);
  if (te < 0) return null;
  const tag = body.slice(o, te + 1);
  const selfClose = tag.endsWith(SL + GT);
  const realTag = selfClose ? tag.slice(0,-1)+GT : tag;
  let name = '';
  const eq = realTag.match(/<function\s*=\s*([^\s>]+)/i);
  const nm = realTag.match(/<function[^>]*\sname\s*=\s*"([^"]*)"/i);
  if (eq) name = eq[1];
  else if (nm) name = nm[1];
  name = name.trim().replace(/\/+$/, '');
  if (!name) return null;
  const inner = selfClose ? '' : (() => {
    const ce = findClose(body, te + 1, FN_CLOSE_VARS);
    return ce ? body.slice(te + 1, ce.idx) : body.slice(te + 1);
  })();
  const args: Record<string, unknown> = {};
  let p = 0;
  while (p < inner.length) {
    const po = inner.toLowerCase().indexOf('<parameter', p);
    if (po < 0) break;
    const pte = inner.indexOf(GT, po);
    if (pte < 0) break;
    const ptag = inner.slice(po, pte + 1);
    const pSelfClose = ptag.endsWith(SL + GT);
    const realPtag = pSelfClose ? ptag.slice(0,-1)+GT : ptag;
    if (pSelfClose) {
      const km = realPtag.match(/<parameter\s*=\s*([^\s>]+)/i);
      if (km) args[km[1].trim()] = true;
      p = pte + 1; continue;
    }
    const pc = findClose(inner, pte + 1, PARAM_CLOSE_VARS);
    if (!pc) break;
    const val = inner.slice(pte + 1, pc.idx);
    const km = realPtag.match(/<parameter\s*=\s*([^\s>]+)/i) || realPtag.match(/<parameter[^>]*\sname\s*=\s*"([^"]*)"/i);
    const key = (km ? km[1] : 'value').trim();
    if (key) args[key] = coerce(val);
    p = pc.end;
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
  try { return JSON.parse(t); } catch { /* */ }
  return t;
}
