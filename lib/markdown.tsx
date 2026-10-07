import React from 'react';

/**
 * Tiny safe Markdown renderer for Tolesh chat messages.
 *
 * IMPORTANT: we do NOT call escapeHtml() on plain text because React already
 * escapes text children when rendered inside JSX. Escaping twice produces
 * literal entities like &#39; in the UI.
 *
 * Supported: bold (**x** / __x__), italic (*x* / _x_), inline `code`,
 * links [text](url), bullet lists (- /*), ordered lists (1.), blockquotes (>),
 * headings (##), paragraphs. Links are restricted to http(s) so javascript:
 * URLs cannot be injected.
 */

const LINK_RE = /\[(?<text>[^\]]+)\]\((?<url>https?:[^)\s]+)\)/g;
const BOLD_RE = /\*\*(?<b>[^*]+)\*\*|__(?<b2>[^_]+)__/g;
const ITAL_RE  = /\*(?<i>[^*\s][^*]*)\*|_(?<i2>[^_\s][^_]*)_/g;
const CODE_RE  = /`(?<c>[^`]+)`/g;

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; text: string; url: string };

/** Tokenize a single line of inline Markdown, longest-token-first. */
function tokenize(src: string): Token[] {
  type Match = { start: number; end: number; tok: Token };
  const matches: Match[] = [];
  const add = (re: RegExp, build: (m: RegExpExecArray) => Token) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      matches.push({ start: m.index, end: m.index + m[0].length, tok: build(m) });
    }
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
    out.push(m.tok);
    i = m.end;
  }
  if (i < src.length) out.push({ kind: 'text', value: src.slice(i) });
  return out;
}

function renderInlineTokens(text: string, keyPrefix = 'i'): React.ReactNode[] {
  return tokenize(text).map((t, idx) => {
    const k = `${keyPrefix}-${idx}`;
    switch (t.kind) {
      case 'text':   return <React.Fragment key={k}>{t.value}</React.Fragment>;
      case 'bold':   return <strong key={k} style={{ fontWeight: 700 }}>{t.value}</strong>;
      case 'italic': return <em key={k}>{t.value}</em>;
      case 'code':   return (
        <code key={k} style={{
          background: 'rgba(127,127,127,0.18)',
          padding: '1px 5px',
          borderRadius: 4,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.85em',
        }}>{t.value}</code>
      );
      case 'link':   return (
        <a key={k} href={t.url} target="_blank" rel="noopener noreferrer" style={{
          color: 'var(--tt-accent, #2563eb)',
          textDecoration: 'underline',
        }}>{t.text}</a>
      );
    }
  });
}

interface Block {
  type: 'p' | 'ul' | 'ol' | 'quote' | 'heading';
  level?: number;
  items?: string[];
  text?: string;
}

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items }); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items }); continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', text: q.join(' ') }); continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2] });
      i++; continue;
    }
    if (!line.trim()) { i++; continue; }
    const p: string[] = [line]; i++;
    while (i < lines.length && lines[i].trim()
           && !/^\s*[-*]\s+/.test(lines[i])
           && !/^\s*\d+\.\s+/.test(lines[i])
           && !/^\s*>\s?/.test(lines[i])
           && !/^#{1,3}\s+/.test(lines[i])) { p.push(lines[i]); i++; }
    blocks.push({ type: 'p', text: p.join(' ') });
  }
  return blocks;
}

const Markdown: React.FC<{ text: string; isDark?: boolean; accent?: string }> = ({ text, isDark, accent }) => {
  const blocks = parseBlocks(text);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {blocks.map((b, i) => {
        if (b.type === 'p')
          return <p key={i} style={{ margin: 0, lineHeight: 1.65 }}>{renderInlineTokens(b.text || '', `p${i}`)}</p>;
        if (b.type === 'ul')
          return <ul key={i} style={{ margin: 0, paddingLeft: '1.35rem', lineHeight: 1.6 }}>
            {(b.items || []).map((it, j) =>
              <li key={j} style={{ marginBottom: '0.2rem' }}>{renderInlineTokens(it, `ul${i}-${j}`)}</li>
            )}
          </ul>;
        if (b.type === 'ol')
          return <ol key={i} style={{ margin: 0, paddingLeft: '1.45rem', lineHeight: 1.6 }}>
            {(b.items || []).map((it, j) =>
              <li key={j} style={{ marginBottom: '0.2rem' }}>{renderInlineTokens(it, `ol${i}-${j}`)}</li>
            )}
          </ol>;
        if (b.type === 'quote')
          return <blockquote key={i} style={{
            margin: 0, padding: '0.4rem 0.85rem',
            borderLeft: `3px solid ${(accent ?? '#2563eb')}66`,
            color: isDark ? '#d4d4d8' : '#4b5563',
            fontStyle: 'italic',
            borderRadius: 2,
          }}>{renderInlineTokens(b.text || '', `q${i}`)}</blockquote>;
        if (b.type === 'heading') {
          const size = b.level === 1 ? '1.05rem' : b.level === 2 ? '0.98rem' : '0.92rem';
          return <div key={i} style={{ fontSize: size, fontWeight: 700, lineHeight: 1.4, marginTop: '0.2rem' }}>
            {renderInlineTokens(b.text || '', `h${i}`)}
          </div>;
        }
        return null;
      })}
    </div>
  );
};

export default Markdown;
