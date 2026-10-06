import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, ShieldCheck, Headphones } from 'lucide-react';
import ToleshAvatar from './ToleshAvatar';
import Markdown from '../lib/markdown';

export type ToleshMode = 'public' | 'admin' | 'client';

interface Props { mode?: ToleshMode; open: boolean; onClose: () => void; }

interface Msg { role: 'user' | 'assistant'; content: string; pending?: boolean; error?: boolean; thinking?: boolean; }

const greetings: Record<ToleshMode, string> = {
  public:
    "Hi, I'm Tolesh — Toluene Tech's assistant. I can answer questions about our services, pricing, process and selected work. What are you building?",
  admin:
    "Hi, I'm Tolesh for Admins. I can pull quick stats, draft replies, summarise leads, and help navigate the control centre. What do you need today?",
  client:
    "Hi, I'm Tolesh for clients. I can answer questions about your project, milestones, files and invoices — and I'll flag anything I can't answer for the team. What do you need?",
};

const titleFor: Record<ToleshMode, string> = {
  public: 'Tolesh AI',
  admin: 'Tolesh AI · Admin',
  client: 'Tolesh AI · Client',
};

const subtitleFor: Record<ToleshMode, string> = {
  public: 'Public assistant · fast answers grounded in our services.',
  admin: 'Admin copilot · summarises CRM & CMS data.',
  client: 'Client assistant · sees only your project data.',
};

const iconFor = (mode: ToleshMode) =>
  mode === 'admin' ? <ShieldCheck className="h-3.5 w-3.5" /> :
  mode === 'client' ? <Headphones className="h-3.5 w-3.5" /> :
  <Sparkles className="h-3.5 w-3.5" />;

function endpointFor(mode: ToleshMode): string {
  const _env = (import.meta as unknown as { env?: { VITE_API_URL?: string; DEV?: boolean } }).env;
  const base = _env?.VITE_API_URL ?? (_env?.DEV ? '' : 'https://toluene-tech-api.toluenetech.workers.dev');
  return mode === 'admin' ? `${base}/assistant/admin`
       : mode === 'client' ? `${base}/assistant/client`
       : `${base}/assistant/chat`;
}
function sidKey(mode: ToleshMode): string { return `tt_${mode}_sid`; }

/**
 * Tolesh AI chat panel — ChatGPT-style layout:
 *   - User bubbles hug the RIGHT edge (gray/dark bg).
 *   - Assistant messages sit on the LEFT, prefaced by the TT avatar.
 *   - While the model is thinking we show a pulsing "Thinking…" row (NOT a
 *     spinner inside the bubble), which is replaced by the real answer.
 *   - Messages use a soft rounded-bubble shape; input bar is sticky at
 *     the bottom with a large rounded Send button.
 */
const ToleshChat: React.FC<Props> = ({ mode: m = 'public', open, onClose }) => {
  const mode = m as ToleshMode;
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greetings[mode] }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [open, messages]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [input]);

  if (!open) return null;

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setBusy(true);
    // Insert a "Thinking…" placeholder as its own assistant row (no bubble content yet).
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
      let reply = '';
      if (!res.ok) {
        let err = `Server error (${res.status})`;
        try { const j = await res.json() as { error?: string }; if (j.error) err = j.error; } catch { /* ignore */ }
        throw new Error(err);
      }
      const data = await res.json() as { reply: string; anonId?: string };
      reply = data.reply ?? '';
      if (data.anonId) localStorage.setItem(sidKey(mode), data.anonId);

      setMessages(prev => {
        const copy = [...prev];
        // Replace the thinking placeholder with the real reply
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].thinking) { copy[i] = { role: 'assistant', content: reply }; break; }
        }
        return copy;
      });
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].thinking) { copy[i] = { role: 'assistant', content: (err as Error).message || 'Something went wrong.', error: true }; break; }
        }
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void ask(input); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input); }
  };

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Palette (ChatGPT-inspired)
  const bg       = isDark ? '#18181b' : '#ffffff';
  const border   = isDark ? '#27272a' : '#e5e7eb';
  const fg       = isDark ? '#f4f4f5' : '#18181b';
  const muted    = isDark ? '#a1a1aa' : '#6b7280';
  const panel    = isDark ? '#212124' : '#f4f4f5';   // header + input bg
  const userBubbleBg = isDark ? '#2a2a2e' : '#f4f4f5';
  const userBubbleFg = fg;
  const botBubbleBg  = 'transparent';                // ChatGPT-style "no bubble" for assistant
  const botBubbleFg  = fg;
  const accent       = mode === 'admin' ? '#f59e0b' : mode === 'client' ? '#10b981' : '#2563eb';

  return (
    <div
      role="dialog" aria-label={`${titleFor[mode]} chat`}
      style={{
        position: 'fixed', right: '1.25rem', bottom: '5rem', zIndex: 70,
        width: 'min(25rem, calc(100vw - 2rem))', height: 'min(36rem, calc(100vh - 8rem))',
        background: bg, color: fg, border: `1px solid ${border}`,
        borderRadius: '14px', boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0.85rem 1rem', borderBottom: `1px solid ${border}`,
        background: panel, display: 'flex', alignItems: 'center', gap: '0.7rem',
      }}>
        <ToleshAvatar size={34} mode={mode} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {titleFor[mode]}
            <span style={{
              fontSize: '0.62rem', padding: '1px 7px', borderRadius: '999px',
              background: `${accent}1f`, color: accent,
              display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600,
            }}>{iconFor(mode)} beta</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: muted }}>{subtitleFor[mode]}</div>
        </div>
        <button
          onClick={onClose} aria-label="Close"
          style={{
            width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent',
            color: muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><X className="h-4 w-4" /></button>
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: 'auto', padding: '1rem 1rem 0.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '78%', padding: '0.6rem 0.85rem', borderRadius: '18px',
                  borderBottomRightRadius: 6, background: userBubbleBg, color: userBubbleFg,
                  fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{m.content}</div>
              </div>
            );
          }
          // Assistant — left side, TT avatar inline.
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <ToleshAvatar size={28} mode={mode} />
              <div style={{ flex: 1, minWidth: 0, paddingTop: '0.1rem' }}>
                {m.thinking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: muted, fontSize: '0.88rem' }}>
                    <span className="tt-thinking-dots" aria-hidden>
                      <span /> <span /> <span />
                    </span>
                    <span style={{ fontStyle: 'italic' }}>Thinking</span>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.9rem', color: botBubbleFg,
                      wordBreak: 'break-word',
                      '--tt-accent': accent,
                      ...(m.error ? { color: isDark ? '#fca5a5' : '#b91c1c' } : {}),
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
        margin: '0.75rem', padding: '0.45rem 0.55rem 0.45rem 0.9rem',
        border: `1px solid ${border}`, borderRadius: '22px', background: panel,
        display: 'flex', alignItems: 'flex-end', gap: '0.4rem',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          rows={1}
          placeholder={mode === 'admin'
            ? 'Ask about leads, projects, content, or draft something…'
            : mode === 'client'
              ? 'Ask about your project, milestones, files… (Shift+Enter for newline)'
              : 'Message Tolesh…'}
          style={{
            flex: 1, border: 'none', outline: 'none', resize: 'none',
            background: 'transparent', color: fg, fontSize: '0.9rem', lineHeight: 1.5,
            fontFamily: 'inherit', padding: '0.45rem 0', maxHeight: 140,
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          style={{
            width: '2.1rem', height: '2.1rem', borderRadius: '999px', border: 'none',
            background: input.trim() && !busy ? accent : (isDark ? '#3f3f46' : '#e5e7eb'),
            color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0, transition: 'background-color 0.15s',
          }}
        ><Send className="h-4 w-4" /></button>
      </form>

      <div style={{
        textAlign: 'center', fontSize: '0.7rem', color: muted, padding: '0 0 0.6rem',
      }}>
        Tolesh can make mistakes — verify important information.
      </div>

      {/* Thinking-dot animation */}
      <style>{`
        .tt-thinking-dots { display:inline-flex; gap:4px; align-items:center; }
        .tt-thinking-dots span {
          width:6px; height:6px; border-radius:50%;
          background: ${accent}; opacity:.35; display:inline-block;
          animation: tt-bounce 1.2s infinite ease-in-out;
        }
        .tt-thinking-dots span:nth-child(2) { animation-delay:.15s; }
        .tt-thinking-dots span:nth-child(3) { animation-delay:.3s; }
        @keyframes tt-bounce {
          0%,80%,100% { transform: translateY(0); opacity:.35; }
          40% { transform: translateY(-3px); opacity:1; }
        }
      `}</style>
    </div>
  );
};

export default ToleshChat;