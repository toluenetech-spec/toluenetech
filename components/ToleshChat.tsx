import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, Sparkles, ShieldCheck, Headphones } from 'lucide-react';
import ToleshAvatar from './ToleshAvatar';

export type ToleshMode = 'public' | 'admin' | 'client';

interface Props {
  mode?: ToleshMode;
  open: boolean;
  onClose: () => void;
}

interface Msg { role: 'user' | 'assistant'; content: string; pending?: boolean; error?: boolean; }

const greetings: Record<ToleshMode, string> = {
  public:
    "Hi, I'm Tolesh — Toluene Tech's assistant. I can answer questions about our services, pricing, process and selected work. What are you building?",
  admin:
    "Hi, I'm Tolesh for Admins. I can pull quick stats, draft replies, summarise leads, and help you navigate the control centre. What do you need today?",
  client:
    "Hi, I'm Tolesh for clients. I can answer questions about your project, milestones, files and invoices — and I'll flag anything I can't answer for the team. What do you need?",
};

const titleFor: Record<ToleshMode, string> = {
  public: 'Tolesh AI',
  admin: 'Tolesh AI · Admin',
  client: 'Tolesh AI · Client',
};

const subtitleFor: Record<ToleshMode, string> = {
  public: 'Answers grounded in our public services & FAQ.',
  admin: 'Grounds answers in real CRM / CMS data.',
  client: 'Sees only your project data — never other clients.',
};

const iconFor = (mode: ToleshMode) =>
  mode === 'admin' ? <ShieldCheck className="h-3.5 w-3.5" /> :
  mode === 'client' ? <Headphones className="h-3.5 w-3.5" /> :
  <Sparkles className="h-3.5 w-3.5" />;

function endpointFor(mode: ToleshMode): string {
  const _env = (import.meta as unknown as { env?: { VITE_API_URL?: string; DEV?: boolean } }).env;
  const base = _env?.VITE_API_URL ?? (_env?.DEV ? '' : 'https://toluene-tech-api.toluenetech.workers.dev');
  switch (mode) {
    case 'admin':  return `${base}/assistant/admin`;
    case 'client': return `${base}/assistant/client`;
    default:       return `${base}/assistant/chat`;
  }
}

function sidKey(mode: ToleshMode): string { return `tt_${mode}_sid`; }

/**
 * Shared Tolesh AI chat panel.
 * Launcher (floating button) lives outside this component so admins and clients
 * can render the widget from different triggers. When open=true the panel is shown.
 */
const ToleshChat: React.FC<Props> = ({ mode: m = 'public', open, onClose }) => {
  const mode = m as ToleshMode;
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greetings[mode] }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [open, messages]);

  if (!open) return null;

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMessages(m => [...m, { role: 'user', content: trimmed }]);
    setInput('');
    setBusy(true);
    setMessages(m => [...m, { role: 'assistant', content: '', pending: true }]);
    try {
      let sid = localStorage.getItem(sidKey(mode));
      const url = endpointFor(mode);
      const init = { message: trimmed, anonId: sid ?? undefined };
      // Auth headers for admin/client — use firebase ID token if available.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sid) headers['X-Anon-Id'] = sid;
      // Mode-specific auth headers.
      // - Admin: sends X-TT-Admin-Password from localStorage (matches the current admin login flow).
      // - Client: sends X-TT-Client-Demo=1 during the migration window; swapped for JWT once Firebase auth lands.
      if (mode === 'admin') {
        const pw = localStorage.getItem('tt_admin_session') || sessionStorage.getItem('tt_admin_session') || '';
        if (pw) headers['X-TT-Admin-Password'] = pw;
      } else if (mode === 'client') {
        headers['X-TT-Client-Demo'] = '1';
        try {
          const sess = JSON.parse(localStorage.getItem('tt_client_session') || 'null');
          if (sess?.email) headers['X-TT-Client-Email'] = sess.email;
          if (sess?.code)  headers['X-TT-Client-Code']  = sess.code;
        } catch { /* ignore */ }
      }
      // Best-effort Firebase ID token (future-proof; harmless if absent).
      try {
        const fb = await import('../firebase') as unknown as { auth?: { currentUser: { getIdToken: () => Promise<string> } | null } };
        if (fb.auth?.currentUser) {
          const tok = await fb.auth.currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${tok}`;
        }
      } catch { /* no firebase available */ }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(init),
      });
      if (!res.ok) {
        let err = `Server error (${res.status})`;
        try { const j = await res.json() as { error?: string }; if (j.error) err = j.error; } catch { /* ignore */ }
        throw new Error(err);
      }
      const data = await res.json() as { reply: string; anonId?: string };
      if (data.anonId) localStorage.setItem(sidKey(mode), data.anonId);
      setMessages(m => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].pending) { copy[i] = { role: 'assistant', content: data.reply }; break; }
        }
        return copy;
      });
    } catch (err) {
      setMessages(m => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].pending) { copy[i] = { role: 'assistant', content: (err as Error).message || 'Something went wrong.', error: true }; break; }
        }
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void ask(input); };

  // Compute palette per mode
  const accent = mode === 'admin' ? '#f59e0b' : mode === 'client' ? '#10b981' : '#2563eb';
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const panelBg = isDark ? '#111827' : '#ffffff';
  const panelBorder = isDark ? '#1f2937' : '#e5e7eb';
  const panelFg = isDark ? '#f8fafc' : '#0b1220';
  const botBubbleBg = isDark ? '#1f2937' : '#f3f4f6';
  const userBubbleBg = '#0b1220';
  const userBubbleFg = '#ffffff';

  return (
    <div
      role="dialog"
      aria-label={`${titleFor[mode]} chat`}
      style={{
        position: 'fixed', right: '1.25rem', bottom: '5rem', zIndex: 70,
        width: 'min(24rem, calc(100vw - 2rem))', height: 'min(30rem, calc(100vh - 8rem))',
        background: panelBg, color: panelFg, border: `1px solid ${panelBorder}`,
        borderRadius: '14px', boxShadow: '0 24px 48px rgba(15,23,42,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '0.85rem 1rem', borderBottom: `1px solid ${panelBorder}`,
        display: 'flex', alignItems: 'center', gap: '0.7rem',
      }}>
        <ToleshAvatar size={36} mode={mode} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {titleFor[mode]}
            <span style={{
              fontSize: '0.62rem', padding: '1px 6px', borderRadius: '999px',
              background: `${accent}22`, color: accent, display: 'inline-flex', alignItems: 'center', gap: 3,
              fontWeight: 600,
            }}>{iconFor(mode)} beta</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: isDark ? '#9ca3af' : '#6b7280' }}>{subtitleFor[mode]}</div>
        </div>
        <button
          onClick={onClose} aria-label="Close"
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: 'transparent', color: 'inherit', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><X className="h-4 w-4" /></button>
      </div>

      <div
        ref={listRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '0.9rem 1rem',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'assistant' && <ToleshAvatar size={28} mode={mode} />}
            <div style={{
              maxWidth: '78%', padding: '0.6rem 0.8rem', borderRadius: '10px', fontSize: '0.86rem', lineHeight: 1.55,
              background: m.role === 'user' ? userBubbleBg : m.error ? (isDark ? '#3f1d1d' : '#fef2f2') : botBubbleBg,
              color: m.role === 'user' ? userBubbleFg : m.error ? (isDark ? '#fecaca' : '#991b1b') : panelFg,
              border: m.error ? `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}` : 'none',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : m.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} style={{
        display: 'flex', gap: '0.5rem', padding: '0.7rem 0.85rem 0.9rem',
        borderTop: `1px solid ${panelBorder}`,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder={mode === 'admin'
            ? 'Ask about leads, projects, content, or ask me to draft…'
            : mode === 'client'
              ? 'Ask about your project, milestones, files…'
              : 'Ask about services, pricing, process…'}
          style={{
            flex: 1, padding: '0.65rem 0.8rem',
            border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
            borderRadius: 8, fontSize: '0.86rem', outline: 'none',
            background: isDark ? '#0b1220' : '#fff', color: panelFg,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit" disabled={busy}
          aria-label="Send"
          style={{
            width: '2.4rem', height: '2.4rem', borderRadius: 8, border: 'none',
            background: '#0b1220', color: '#fff', cursor: busy ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
};

export default ToleshChat;
