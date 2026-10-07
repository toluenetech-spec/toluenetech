import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, ShieldCheck, Headphones } from 'lucide-react';
import ToleshAvatar from './ToleshAvatar';
import Markdown from '../lib/markdown';

export type ToleshMode = 'public' | 'admin' | 'client';

interface Props { mode?: ToleshMode; open: boolean; onClose: () => void; }
interface Msg { role: 'user' | 'assistant'; content: string; error?: boolean; thinking?: boolean; }

const greetings: Record<ToleshMode, string> = {
  public:
    "Hi, I'm Tolesh — Toluene Tech's assistant. I can answer questions about our services, pricing, process and selected work. What are you building?",
  admin:
    "Hi, I'm Tolesh for Admins. I can pull quick stats, draft replies, summarise leads, and help navigate the control centre. What do you need today?",
  client:
    "Hi, I'm Tolesh for clients. I can answer questions about your project, milestones, files and invoices — and I'll flag anything I can't answer for the team. What do you need?",
};
const titleFor:    Record<ToleshMode, string> = { public: 'Tolesh AI', admin: 'Tolesh AI · Admin', client: 'Tolesh AI · Client' };
const subtitleFor: Record<ToleshMode, string> = {
  public: 'Fast answers grounded in our services.',
  admin:  'Summarises CRM & CMS data.',
  client: 'Sees only your project data.',
};
const pillIcon = (mode: ToleshMode) =>
  mode === 'admin' ? <ShieldCheck size={11} /> :
  mode === 'client' ? <Headphones size={11} /> :
  <Sparkles size={11} />;

function endpointFor(mode: ToleshMode): string {
  const env = (import.meta as unknown as { env?: { VITE_API_URL?: string; DEV?: boolean } }).env;
  const base = env?.VITE_API_URL ?? (env?.DEV ? '' : 'https://toluene-tech-api.toluenetech.workers.dev');
  return mode === 'admin' ? `${base}/assistant/admin`
       : mode === 'client' ? `${base}/assistant/client`
       : `${base}/assistant/chat`;
}
const sidKey = (m: ToleshMode) => `tt_${m}_sid`;

const ToleshChat: React.FC<Props> = ({ mode: m = 'public', open, onClose }) => {
  const mode = m as ToleshMode;
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greetings[mode] }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const accent = mode === 'admin' ? '#f59e0b' : mode === 'client' ? '#10b981' : '#2563eb';
  const bg       = isDark ? '#212121' : '#ffffff';
  const headerBg = isDark ? '#2b2b2b' : '#f7f7f8';
  const border   = isDark ? '#333333' : '#e5e7eb';
  const fg       = isDark ? '#ececf1' : '#0d0d0d';
  const muted    = isDark ? '#9ca3af' : '#6b7280';
  const inputBg  = isDark ? '#2f2f2f' : '#ffffff';
  const userBubbleBg = isDark ? '#2f2f2f' : '#f4f4f5';

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  if (!open) return null;

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setBusy(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: true }]);

    try {
      let sid = localStorage.getItem(sidKey(mode));
      const url = endpointFor(mode);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sid) headers['X-Anon-Id'] = sid;
      if (mode === 'admin') {
        const pw = sessionStorage.getItem('tt_admin_session') || '';
        if (pw) headers['X-TT-Admin-Password'] = pw;
      } else if (mode === 'client') {
        headers['X-TT-Client-Demo'] = '1';
        try {
          const sess = JSON.parse(localStorage.getItem('tt_client_session') || 'null');
          if (sess?.email) headers['X-TT-Client-Email'] = sess.email;
          if (sess?.code)  headers['X-TT-Client-Code']  = sess.code;
        } catch { /* ignore */ }
      }
      try {
        const fb = await import('../firebase') as unknown as { auth?: { currentUser: { getIdToken: () => Promise<string> } | null } };
        if (fb.auth?.currentUser) headers['Authorization'] = `Bearer ${await fb.auth.currentUser.getIdToken()}`;
      } catch { /* ignore */ }

      const res = await fetch(url, {
        method: 'POST', headers,
        body: JSON.stringify({ message: trimmed, anonId: sid ?? undefined }),
      });
      if (!res.ok) {
        let err = `Server error (${res.status})`;
        try { const j = await res.json() as { error?: string }; if (j.error) err = j.error; } catch { /* ignore */ }
        throw new Error(err);
      }
      const data = await res.json() as { reply: string; anonId?: string };
      const reply = (data.reply ?? '').trim();
      if (data.anonId) localStorage.setItem(sidKey(mode), data.anonId);

      setMessages(prev => {
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].thinking) { copy[i] = { role: 'assistant', content: reply }; break; }
        }
        return copy;
      });
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev];
        const msg = (err as Error).message || "I couldn't reach our models — try again in a moment.";
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].thinking) { copy[i] = { role: 'assistant', content: msg, error: true }; break; }
        }
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void ask(input); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input); }
  };

  return (
    <div
      role="dialog" aria-label={`${titleFor[mode]} chat`}
      style={{
        position: 'fixed',
        right: 'clamp(0.75rem, 3vw, 1.25rem)',
        bottom: 'clamp(4.75rem, 9vh, 5.75rem)',
        zIndex: 70,
        width: 'min(24rem, calc(100vw - 1.5rem))',
        height: 'min(38rem, calc(100dvh - 8rem))',
        background: bg, color: fg,
        border: `1px solid ${border}`,
        borderRadius: 'clamp(12px, 2vw, 16px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: '"Söhne", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0.8rem 1rem',
        borderBottom: `1px solid ${border}`,
        background: headerBg,
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <ToleshAvatar size={38} mode={mode} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: 1.2 }}>
            {titleFor[mode]}
            <span style={{
              fontSize: '0.65rem', padding: '2px 8px', borderRadius: '999px',
              background: `${accent}1f`, color: accent,
              display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600,
              letterSpacing: '0.02em',
            }}>{pillIcon(mode)} beta</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: muted, lineHeight: 1.25, marginTop: 2 }}>
            {subtitleFor[mode]}
          </div>
        </div>
        <button
          onClick={onClose} aria-label="Close"
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
            color: muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><X size={18} /></button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '1.2rem 1rem 0.6rem',
          display: 'flex', flexDirection: 'column', gap: '1.2rem',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '0.6rem 0.95rem',
                  borderRadius: '18px',
                  borderBottomRightRadius: 6,
                  background: userBubbleBg,
                  color: fg,
                  fontSize: '0.92rem', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{m.content}</div>
              </div>
            );
          }
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ flexShrink: 0, width: 32, paddingTop: 1 }}>
                <ToleshAvatar size={30} mode={mode} />
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: '0.3rem' }}>
                {m.thinking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: muted, fontSize: '0.9rem' }}>
                    <span className="tt-thinking-dots" aria-hidden>
                      <span /><span /><span />
                    </span>
                    <span>
                      <span>Tolesh is thinking</span>
                      <span className="tt-dots-ellipsis" aria-hidden>…</span>
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.92rem',
                      lineHeight: 1.65,
                      color: m.error ? (isDark ? '#fca5a5' : '#b91c1c') : fg,
                      wordBreak: 'break-word',
                      '--tt-accent': accent,
                    } as React.CSSProperties}
                  >
                    <Markdown text={m.content} isDark={isDark} accent={accent} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} style={{
        margin: '0.6rem 0.85rem 0.25rem',
        padding: '0.55rem 0.55rem 0.55rem 1rem',
        border: `1px solid ${border}`,
        borderRadius: '26px',
        background: inputBg,
        display: 'flex', alignItems: 'flex-end', gap: '0.5rem',
        boxShadow: isDark ? 'inset 0 0 0 1px rgba(255,255,255,0.03)' : 'inset 0 0 0 1px rgba(0,0,0,0.02)',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          rows={1}
          placeholder={mode === 'admin'
            ? 'Ask about leads, projects, content…'
            : mode === 'client'
              ? 'Ask about your project, milestones, files…'
              : 'Message Tolesh…'}
          style={{
            flex: 1, border: 'none', outline: 'none', resize: 'none',
            background: 'transparent', color: fg, fontSize: '0.92rem', lineHeight: 1.5,
            fontFamily: 'inherit', padding: '0.45rem 0', maxHeight: 160,
            caretColor: accent,
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send message"
          style={{
            width: '2.15rem', height: '2.15rem', borderRadius: '999px', border: 'none',
            background: input.trim() && !busy ? accent : (isDark ? '#3f3f46' : '#d1d5db'),
            color: input.trim() && !busy ? '#ffffff' : (isDark ? '#a1a1aa' : '#6b7280'),
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0, marginBottom: 2,
            transition: 'background-color 0.15s, color 0.15s',
          }}
        ><Send size={15} /></button>
      </form>

      <div style={{
        textAlign: 'center', fontSize: '0.7rem', color: muted, padding: '0.4rem 0 0.7rem',
        lineHeight: 1.3,
      }}>
        Tolesh can make mistakes — verify important information.
      </div>

      <style>{`
        .tt-thinking-dots { display:inline-flex; gap:3px; align-items:center; }
        .tt-thinking-dots span {
          width:6px; height:6px; border-radius:50%;
          background: ${accent}; opacity:.4; display:inline-block;
          animation: tt-bounce 1.3s infinite ease-in-out;
        }
        .tt-thinking-dots span:nth-child(2) { animation-delay:.18s; }
        .tt-thinking-dots span:nth-child(3) { animation-delay:.36s; }
        @keyframes tt-bounce {
          0%,80%,100% { transform: translateY(0); opacity:.4; }
          40% { transform: translateY(-3px); opacity:1; }
        }
        .tt-dots-ellipsis {
          display:inline-block; width:14px; text-align:left; overflow:hidden; vertical-align:bottom;
          animation: tt-ellipsis steps(4,end) 1.2s infinite;
        }
        @keyframes tt-ellipsis {
          0%   { width: 0; }
          25%  { width: 3px; }
          50%  { width: 7px; }
          75%  { width: 11px; }
          100% { width: 14px; }
        }
      `}</style>
    </div>
  );
};

export default ToleshChat;
