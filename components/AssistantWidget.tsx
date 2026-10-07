import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, AlertCircle } from 'lucide-react';
import { sendChatMessage } from '../lib/api';

interface Msg { role: 'user' | 'assistant'; content: string; pending?: boolean; error?: boolean; }

const WELCOME: Msg = {
  role: 'assistant',
  content: "Hi — I'm the Toluene Tech assistant. I can answer questions about our services, pricing, process and selected work. What are you building?",
};

/**
 * Floating public-site assistant.
 * - Only shown on public pages (toggle via `enabled` prop or env).
 * - Never exposes an API key; calls go to the Worker.
 * - Opt-in name/email capture when the user signals intent to start a project.
 */
const AssistantWidget: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [contactStep, setContactStep] = useState<null | 'name' | 'email'>(null);
  const [nameBuf, setNameBuf] = useState('');
  const [emailBuf, setEmailBuf] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [open, messages]);

  if (!enabled) return null;

  const ask = async (text: string, extra: { name?: string; email?: string } = {}) => {
    if (!text.trim() || busy) return;
    setMessages(m => [...m, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    setMessages(m => [...m, { role: 'assistant', content: '', pending: true }]);
    try {
      const res = await sendChatMessage(text.trim(), extra);
      setMessages(m => {
        const copy = [...m];
        // replace last pending
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].pending) { copy[i] = { role: 'assistant', content: res.reply }; break; }
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contactStep === 'name') {
      const name = nameBuf.trim();
      if (!name) return;
      setContactStep('email');
      setMessages(m => [...m, { role: 'assistant', content: `Thanks ${name.split(' ')[0]}. What's the best email to reach you on?` }]);
      setNameBuf('');
      return;
    }
    if (contactStep === 'email') {
      const email = emailBuf.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        setMessages(m => [...m, { role: 'assistant', content: "That doesn't look like a valid email — could you double-check?" }]);
        return;
      }
      setContactStep(null);
      setEmailBuf('');
      // fire off a project-intent message with the contact info attached
      void ask("I'd like to start a project — please have someone reach out to me.", { name: nameBuf || undefined, email });
      return;
    }
    // Heuristic: if the user is clearly ready to start, capture name first.
    const l = input.toLowerCase();
    if (/\b(quote|start|hire|budget|estimate|cost|price|want to build|need a)\b/.test(l) && !localStorage.getItem('tt_contact_offered')) {
      localStorage.setItem('tt_contact_offered', '1');
      setContactStep('name');
      setMessages(m => [...m, { role: 'assistant', content: "Great. Before I hand you off to the team, could I get your first name?" }]);
      setInput('');
      return;
    }
    void ask(input);
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close assistant' : 'Chat with us'}
        style={{
          position: 'fixed', right: '1.25rem', bottom: '1.25rem', zIndex: 70,
          width: '3.25rem', height: '3.25rem', borderRadius: '999px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: open ? '#0b1220' : '#0b1220', color: '#fff',
          border: '1px solid #0b1220', boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
          cursor: 'pointer',
        }}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat with Toluene Tech"
          style={{
            position: 'fixed', right: '1.25rem', bottom: '5rem', zIndex: 70,
            width: 'min(22rem, calc(100vw - 2rem))', height: 'min(28rem, calc(100vh - 8rem))',
            background: '#ffffff', color: '#0b1220',
            border: '1px solid #e5e7eb', borderRadius: '14px',
            boxShadow: '0 24px 48px rgba(15,23,42,0.18)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
          className="tt-assistant-panel"
        >
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Chat with Toluene Tech</div>
            <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#6b7280' }}>Usually replies instantly</div>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '0.55rem 0.75rem', borderRadius: '10px', fontSize: '0.86rem', lineHeight: 1.5,
                  background: m.role === 'user' ? '#0b1220' : m.error ? '#fef2f2' : '#f3f4f6',
                  color: m.role === 'user' ? '#fff' : m.error ? '#991b1b' : '#0b1220',
                  border: m.error ? '1px solid #fecaca' : 'none',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : m.content}
                  {m.error && !m.pending && <AlertCircle className="inline h-3.5 w-3.5 ml-1" style={{ verticalAlign: '-2px' }} />}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem', padding: '0.7rem 0.85rem', borderTop: '1px solid #e5e7eb' }}>
            <input
              ref={inputRef}
              type="text"
              value={contactStep === 'name' ? nameBuf : contactStep === 'email' ? emailBuf : input}
              onChange={(e) => {
                if (contactStep === 'name') setNameBuf(e.target.value);
                else if (contactStep === 'email') setEmailBuf(e.target.value);
                else setInput(e.target.value);
              }}
              disabled={busy}
              placeholder={
                contactStep === 'name' ? 'Your first name…'
                : contactStep === 'email' ? 'you@company.com'
                : 'Ask about services, pricing, process…'
              }
              style={{
                flex: 1, padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px',
                fontSize: '0.86rem', outline: 'none', color: '#0b1220', background: '#fff',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={busy}
              aria-label="Send"
              style={{
                width: '2.25rem', height: '2.25rem', borderRadius: '8px', border: 'none',
                background: '#0b1220', color: '#fff', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', cursor: busy ? 'wait' : 'pointer', flexShrink: 0,
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <div style={{ padding: '0 0.85rem 0.55rem', fontSize: '0.68rem', color: '#9ca3af', textAlign: 'center' }}>
            Powered by AI — answers grounded in our public content only.
          </div>
        </div>
      )}

      {/* Dark-mode variant */}
      <style>{`
        @media (prefers-color-scheme: dark) {
          .tt-assistant-panel {
            background: #111827 !important;
            color: #f8fafc !important;
            border-color: #1f2937 !important;
          }
          .tt-assistant-panel > div:first-child { border-bottom-color: #1f2937 !important; }
          .tt-assistant-panel input {
            background: #0b1220 !important; color: #f8fafc !important;
            border-color: #374151 !important;
          }
          .tt-assistant-panel [role="dialog"] > div:nth-child(2) > div > div[style*="rgb(243"] {
            background: #1f2937 !important; color: #f8fafc !important;
          }
        }
      `}</style>
    </>
  );
};

export default AssistantWidget;
