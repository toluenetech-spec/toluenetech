import React, { useState } from 'react';

/**
 * Tiny safe Markdown renderer for Tolesh chat messages.
 * Supports: bold, italic, inline `code`, links, lists, blockquotes, headings (##),
 * fenced code blocks (```), simple GitHub-style tables.
 * React escapes text children automatically; no double-escaping.
 */

const LINK_RE = /\[(?<text>[^\]]+)\]\((?<url>https?:[^\)\s]+)\)/g;
const BOLD_RE = /\*\*(?<b>[^*]+)\*\*|__(?<b2>[^_]+)__/g;
const ITAL_RE  = /\*(?<i>[^*\s][^*]*)\*|_(?<i2>[^_\s][^_]*)_/g;
const CODE_RE  = /`(?<c>[^`]+)`/g;

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; text: string; url: string };

function tokenize(src: string): Token[] {
  type Match = { start: number; end: number; tok: Token };
  const matches: Match[] = [];
  const add = (re: RegExp, build: (m: RegExpExecArray) => Token) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) matches.push({ start: m.index, end: m.index + m[0].length, tok: build(m) });
  };
  add(LINK_RE, m => ({ kind: 'link', text: m.groups!.text, url: m.groups!.url }));
  add(CODE_RE, m => ({ kind: 'code', value: m.groups!.c }));
  add(BOLD_RE, m => ({ kind: 'bold', value: m.groups!.b ?? m.groups!.b2 ?? '' }));
  add(ITAL_RE, m => ({ kind: 'italic', value: m.groups!.i ?? m.groups!.i2 ?? '' }));
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out: Token[] = [];
  let i = 0;
  for (const m of matches) {
    if (m.start < i) continue;
    if (m.start > i) out.push({ kind: 'text', value: src.slice(i, m.start) });
    out.push(m.tok); i = m.end;
  }
  if (i < src.length) out.push({ kind: 'text', value: src.slice(i) });
  return out;
}

function renderInline(text: string, keyPrefix = 'i'): React.ReactNode[] {
  return tokenize(text).map((t, idx) => {
    const k = `${keyPrefix}-${idx}`;
    switch (t.kind) {
      case 'text':   return <React.Fragment key={k}>{t.value}</React.Fragment>;
      case 'bold':   return <strong key={k} style={{ fontWeight: 700 }}>{t.value}</strong>;
      case 'italic': return <em key={k}>{t.value}</em>;
      case 'code':   return <code key={k} style={{ background: 'rgba(127,127,127,0.18)', padding: '1px 5px', borderRadius: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85em' }}>{t.value}</code>;
      case 'link':   return <a key={k} href={t.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-accent, #2563eb)', textDecoration: 'underline' }}>{t.text}</a>;
    }
  });
}

interface Block {
  type: 'p' | 'ul' | 'ol' | 'quote' | 'heading' | 'code' | 'table' | 'hr';
  level?: number; text?: string; items?: string[]; lang?: string; code?: string; rows?: string[][]; header?: string[];
}

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1]; i++;
      const code: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
      if (i < lines.length) i++;
      blocks.push({ type: 'code', lang, code: code.join('\n') });
      continue;
    }
    // HR
    if (/^\s*---+\s*$/.test(line)) { blocks.push({ type:'hr' }); i++; continue; }
    // Table: header | header then ---|--- separator then rows
    if (line.includes('|') && i+1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i+1])) {
      const splitRow = (s: string) => s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') { rows.push(splitRow(lines[i])); i++; }
      blocks.push({ type:'table', header, rows });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      blocks.push({ type:'ul', items }); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      blocks.push({ type:'ol', items }); continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      blocks.push({ type:'quote', text: q.join(' ') }); continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { blocks.push({ type:'heading', level: h[1].length, text: h[2] }); i++; continue; }
    if (!line.trim()) { i++; continue; }
    const p: string[] = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]) && !/^#{1,4}\s+/.test(lines[i]) && !/^```/.test(lines[i]) && !/^\s*---+\s*$/.test(lines[i])) { p.push(lines[i]); i++; }
    blocks.push({ type:'p', text: p.join(' ') });
  }
  return blocks;
}

function CodeBlock({ lang, code, ...rest }: { lang?: string; code: string; onCopy?: (code: string, e: React.MouseEvent) => void; } & React.HTMLAttributes<HTMLDivElement>) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <pre {...rest} style={{ position:'relative' }}>
      <code>{code}</code>
      <button className="adm-copy-code" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </pre>
  );
}

const Markdown: React.FC<{ content?: string; text?: string; isDark?: boolean; accent?: string; onCopyCode?: (code: string, e: React.MouseEvent) => void }> = (props) => {
  const text = props.content ?? props.text ?? '';
  const blocks = parseBlocks(text);
  return (
    <div className="adm-md">
      {blocks.map((b, i) => {
        if (b.type === 'p') return <p key={i}>{renderInline(b.text || '', `p${i}`)}</p>;
        if (b.type === 'ul') return <ul key={i}>{(b.items || []).map((it, j) => <li key={j}>{renderInline(it, `ul${i}-${j}`)}</li>)}</ul>;
        if (b.type === 'ol') return <ol key={i}>{(b.items || []).map((it, j) => <li key={j}>{renderInline(it, `ol${i}-${j}`)}</li>)}</ol>;
        if (b.type === 'quote') return <blockquote key={i}>{renderInline(b.text || '', `q${i}`)}</blockquote>;
        if (b.type === 'heading') {
          const level = Math.min(b.level || 2, 4);
          const headingStyle = { fontSize: level === 1 ? '1.05rem' : level === 2 ? '0.98rem' : '0.92rem', fontWeight: 700, lineHeight: 1.4, marginTop: '0.2rem' };
          return <div key={i} style={headingStyle}>{renderInline(b.text || '', `h${i}`)}</div>;
        }
        if (b.type === 'code') return <CodeBlock key={i} lang={b.lang} code={b.code || ''}/>;
        if (b.type === 'hr') return <hr key={i}/>;
        if (b.type === 'table') return (
          <div key={i} style={{ overflowX:'auto' }}>
            <table>
              <thead><tr>{(b.header||[]).map((h, j) => <th key={j}>{renderInline(h,`th${i}-${j}`)}</th>)}</tr></thead>
              <tbody>{(b.rows||[]).map((r, ri) => <tr key={ri}>{r.map((cell, ci) => <td key={ci}>{renderInline(cell,`td${i}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
        return null;
      })}
    </div>
  );
};

export default Markdown;
