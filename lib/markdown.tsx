import React from 'react';

/**
 * Tiny safe Markdown renderer for Tolesh chat messages.
 *
 * Supports: bold (**x** / __x__), italic (*x* / _x_), inline `code`,
 * links [text](url), bullet lists (- /*), ordered lists (1.), blockquotes (>),
 * headings (##), and paragraphs. Escapes HTML so user-supplied content cannot
 * inject scripts or iframes.
 */

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] ?? c));
}

function renderInline(text: string, keyPrefix = 'i'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let k = 0;
  const push = (n: React.ReactNode) => { out.push(<React.Fragment key={`${keyPrefix}-${k++}`}>{n}</React.Fragment>); };
  const token = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|\[([^\]]+)\]\((https?:[^)\s]+)\))/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = token.exec(text))) {
    if (m.index > last) push(escapeHtml(text.slice(last, m.index)));
    if (m[2] !== undefined) push(<strong style={{ fontWeight: 700 }}>{m[2]}</strong>);
    else if (m[3] !== undefined) push(<strong style={{ fontWeight: 700 }}>{m[3]}</strong>);
    else if (m[4] !== undefined) push(<code style={{
      background: 'rgba(127,127,127,0.18)', padding: '1px 5px', borderRadius: 4,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85em',
    }}>{m[4]}</code>);
    else if (m[5] !== undefined) push(<em>{m[5]}</em>);
    else if (m[6] !== undefined) push(<em>{m[6]}</em>);
    else if (m[7] !== undefined && m[8] !== undefined) push(
      <a href={m[8]} target="_blank" rel="noopener noreferrer" style={{
        color: 'var(--tt-accent, #2563eb)', textDecoration: 'underline',
      }}>{m[7]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) push(escapeHtml(text.slice(last)));
  return out;
}

interface Block { type: 'p' | 'ul' | 'ol' | 'quote' | 'heading'; level?: number; items?: string[]; text?: string; }

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++;
      }
      blocks.push({ type: 'ul', items }); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++;
      }
      blocks.push({ type: 'ol', items }); continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, '')); i++;
      }
      blocks.push({ type: 'quote', text: q.join(' ') }); continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { blocks.push({ type: 'heading', level: h[1].length, text: h[2] }); i++; continue; }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {blocks.map((b, i) => {
        if (b.type === 'p')
          return <p key={i} style={{ margin: 0, lineHeight: 1.65 }}>{renderInline(b.text || '', `p${i}`)}</p>;
        if (b.type === 'ul')
          return <ul key={i} style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.6 }}>
            {(b.items || []).map((it, j) => <li key={j} style={{ marginBottom: '0.15rem' }}>{renderInline(it, `ul${i}-${j}`)}</li>)}
          </ul>;
        if (b.type === 'ol')
          return <ol key={i} style={{ margin: 0, paddingLeft: '1.3rem', lineHeight: 1.6 }}>
            {(b.items || []).map((it, j) => <li key={j} style={{ marginBottom: '0.15rem' }}>{renderInline(it, `ol${i}-${j}`)}</li>)}
          </ol>;
        if (b.type === 'quote')
          return <blockquote key={i} style={{
            margin: 0, padding: '0.35rem 0.75rem',
            borderLeft: `3px solid ${(accent ?? '#2563eb')}66`,
            color: isDark ? '#d4d4d8' : '#4b5563', fontStyle: 'italic',
          }}>{renderInline(b.text || '', `q${i}`)}</blockquote>;
        if (b.type === 'heading') {
          const size = b.level === 1 ? '1.05rem' : b.level === 2 ? '0.98rem' : '0.92rem';
          return <div key={i} style={{ fontSize: size, fontWeight: 700, lineHeight: 1.4, marginTop: '0.15rem' }}>{renderInline(b.text || '', `h${i}`)}</div>;
        }
        return null;
      })}
    </div>
  );
};

export default Markdown;
